import type { SubtitlesTrack, SubtitlesTrackSource } from "../track"
import type { Config } from "@/types/config/config"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { isSameLanguage } from "@read-frog/definitions"
import { z } from "zod"
import { getLocalConfig } from "@/utils/config/storage"
import {
  BILIBILI_POST_MESSAGE_TIMEOUT_MS,
  BILIBILI_SUBTITLES_REQUEST_TYPE,
  BILIBILI_SUBTITLES_RESPONSE_TYPE,
} from "@/utils/constants/subtitles"
import { resolveLanguageCodeFromLocale } from "@/utils/content/page-language"
import { i18n } from "@/utils/i18n"
import {
  NoSubtitlesError,
  OverlaySubtitlesError,
  TrackFileNotLoadedError,
} from "@/utils/subtitles/errors"
import { getBilibiliPartId } from "@/utils/subtitles/video-id"
import { fetchWithRetry, readJson } from "../fetch-with-retry"
import { postMessageRequest } from "../post-message-request"

const bilibiliSubtitlesResponseSchema = z.object({
  type: z.string(),
  requestId: z.string(),
  cid: z.number().nullable(),
  subtitles: z.array(z.unknown()).nullable(),
})

export type BilibiliSubtitlesResponse = z.infer<typeof bilibiliSubtitlesResponseSchema>

const subtitleEntrySchema = z.object({
  lan: z.string(),
  subtitle_url: z.string().nonempty(),
  ai_type: z.number().optional(),
})

type SubtitleEntry = z.infer<typeof subtitleEntrySchema>
type TargetLanguage = Config["language"]["targetCode"]

const AI_LAN_PREFIX = /^ai-/
// On an `ai-` entry: speech recognition in the spoken language; translations of it are 1.
const AI_TYPE_TRANSCRIPT = 0

const subtitleFileSchema = z.object({
  body: z.array(z.object({ from: z.number(), to: z.number(), content: z.string() })),
})

async function requestBilibiliSubtitles(partId: string): Promise<BilibiliSubtitlesResponse | null> {
  const response = await postMessageRequest(
    BILIBILI_SUBTITLES_RESPONSE_TYPE,
    { type: BILIBILI_SUBTITLES_REQUEST_TYPE, partId },
    BILIBILI_POST_MESSAGE_TIMEOUT_MS,
  )
  const parsed = bilibiliSubtitlesResponseSchema.safeParse(response)
  return parsed.success ? parsed.data : null
}

function entryLanguage(entry: SubtitleEntry): string {
  return entry.lan.replace(AI_LAN_PREFIX, "")
}

// Without a transcript every AI track is a translation, and Bilibili lists Chinese first even for
// a foreign video; the reader's own language is the one that cannot be the original.
function pickTranslatedSubtitle(
  entries: SubtitleEntry[],
  targetLanguage: TargetLanguage | null,
): SubtitleEntry | undefined {
  const others =
    targetLanguage === null
      ? entries
      : entries.filter((entry) => {
          const language = resolveLanguageCodeFromLocale(entryLanguage(entry))
          return !language || !isSameLanguage(language, targetLanguage)
        })
  const candidates = others.length > 0 ? others : entries
  return candidates.find((entry) => entryLanguage(entry).split("-")[0] === "en") ?? candidates[0]
}

// Bilibili names its AI subtitles `ai-<lang>`; the uploader's own are the better source.
function pickSubtitle(
  subtitles: unknown[],
  targetLanguage: TargetLanguage | null,
): SubtitleEntry | null {
  const entries = subtitles.flatMap((subtitle) => {
    const parsed = subtitleEntrySchema.safeParse(subtitle)
    return parsed.success ? [parsed.data] : []
  })
  const aiEntries = entries.filter((entry) => AI_LAN_PREFIX.test(entry.lan))
  return (
    entries.find((entry) => !AI_LAN_PREFIX.test(entry.lan)) ??
    aiEntries.find((entry) => entry.ai_type === AI_TYPE_TRANSCRIPT) ??
    pickTranslatedSubtitle(aiEntries, targetLanguage) ??
    null
  )
}

async function downloadFragments(subtitle: SubtitleEntry): Promise<SubtitlesFragment[]> {
  // `subtitle_url` comes without a scheme, as `//host/path`.
  const response = await fetchWithRetry(new URL(subtitle.subtitle_url, window.location.href))
  const parsed = subtitleFileSchema.safeParse(await readJson(response))
  if (!parsed.success) throw new TrackFileNotLoadedError()

  return parsed.data.body.map(({ from, to, content }) => ({
    text: content,
    start: Math.round(from * 1000),
    end: Math.round(to * 1000),
  }))
}

async function loadTrack(partId: string): Promise<SubtitlesTrack> {
  const response = await requestBilibiliSubtitles(partId)
  // No reply, or a player that never reached this part: either way the wait ran out.
  if (!response || response.cid === null) {
    throw new OverlaySubtitlesError(i18n.t("subtitles.errors.fetchSubTimeout"))
  }
  if (!response.subtitles) throw new TrackFileNotLoadedError()

  // Bilibili also sends an empty list to a signed-out viewer; signing in is theirs to do.
  const config = await getLocalConfig()
  const subtitle = pickSubtitle(response.subtitles, config?.language.targetCode ?? null)
  if (!subtitle) throw new NoSubtitlesError()

  return {
    language: entryLanguage(subtitle),
    fragments: await downloadFragments(subtitle),
  }
}

export const bilibiliTrackSource: SubtitlesTrackSource = {
  currentKey: getBilibiliPartId,
  load: loadTrack,
}
