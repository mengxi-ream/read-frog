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

interface TrackPreferences {
  /** The `lan` of the track Bilibili's player has selected; null while subtitles are off. */
  playerSelectedLan: string | null
  sourceCode: Config["language"]["sourceCode"] | null
  targetCode: Config["language"]["targetCode"] | null
}

// Bilibili names its AI subtitles `ai-<lang>`; the rest are the uploader's.
const AI_LAN_PREFIX = /^ai-/
// On an AI entry, the speech-recognition transcript in the spoken language; its translations are 1.
const AI_TYPE_TRANSCRIPT = 0
const PLAYER_SELECTED_TRACK_SELECTOR = ".bpx-player-ctrl-subtitle-language-item.bpx-state-active"
const TRACK_KEY_SEPARATOR = "#"

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

function getPlayerSelectedLan(): string | null {
  return document.querySelector<HTMLElement>(PLAYER_SELECTED_TRACK_SELECTOR)?.dataset.lan ?? null
}

function parseEntries(subtitles: unknown[]): SubtitleEntry[] {
  return subtitles.flatMap((subtitle) => {
    const parsed = subtitleEntrySchema.safeParse(subtitle)
    return parsed.success ? [parsed.data] : []
  })
}

function isAiEntry(entry: SubtitleEntry): boolean {
  return AI_LAN_PREFIX.test(entry.lan)
}

function entryLanguage(entry: SubtitleEntry): string {
  return entry.lan.replace(AI_LAN_PREFIX, "")
}

function isInLanguage(entry: SubtitleEntry, language: TrackPreferences["targetCode"]): boolean {
  const entryCode = resolveLanguageCodeFromLocale(entryLanguage(entry))
  return !!language && !!entryCode && isSameLanguage(entryCode, language)
}

/**
 * The original-language track, in YouTube's order where Bilibili has the same signal: the player's
 * selection, the uploader's subtitles, then the AI transcript, before any AI translation.
 */
function pickSubtitle(
  entries: SubtitleEntry[],
  preferences: TrackPreferences,
): SubtitleEntry | null {
  const { playerSelectedLan, sourceCode, targetCode } = preferences
  const notInTargetLanguage = (entry: SubtitleEntry) => !isInLanguage(entry, targetCode)

  // Bilibili selects its Chinese AI translation on its own, so a selection in the reader's target
  // language is the player's default rather than their pick.
  const playerSelected = entries.find((entry) => entry.lan === playerSelectedLan)
  const uploaderSubtitle = entries.find((entry) => !isAiEntry(entry))
  const aiEntries = entries.filter(isAiEntry)
  const aiTranscript = aiEntries.find((entry) => entry.ai_type === AI_TYPE_TRANSCRIPT)
  // With only AI translations left, the reader's source language names the original.
  const aiInSourceLanguage =
    sourceCode && sourceCode !== "auto"
      ? aiEntries.find((entry) => isInLanguage(entry, sourceCode))
      : undefined

  return (
    (playerSelected && notInTargetLanguage(playerSelected) ? playerSelected : undefined) ??
    uploaderSubtitle ??
    aiTranscript ??
    aiInSourceLanguage ??
    aiEntries.find(notInTargetLanguage) ??
    aiEntries[0] ??
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

// The player's selection is part of the key, so switching it in the player loads our track again.
function currentTrackKey(): string | null {
  const partId = getBilibiliPartId()
  if (partId === null) return null
  return [partId, getPlayerSelectedLan() ?? ""].join(TRACK_KEY_SEPARATOR)
}

async function loadTrack(trackKey: string): Promise<SubtitlesTrack> {
  const [partId = "", playerSelectedLan = ""] = trackKey.split(TRACK_KEY_SEPARATOR)
  const response = await requestBilibiliSubtitles(partId)
  // No reply, or a player that never reached this part: either way the wait ran out.
  if (!response || response.cid === null) {
    throw new OverlaySubtitlesError(i18n.t("subtitles.errors.fetchSubTimeout"))
  }
  if (!response.subtitles) throw new TrackFileNotLoadedError()

  // Bilibili also sends an empty list to a signed-out viewer; signing in is theirs to do.
  const config = await getLocalConfig()
  const subtitle = pickSubtitle(parseEntries(response.subtitles), {
    playerSelectedLan: playerSelectedLan || null,
    sourceCode: config?.language.sourceCode ?? null,
    targetCode: config?.language.targetCode ?? null,
  })
  if (!subtitle) throw new NoSubtitlesError()

  return {
    language: entryLanguage(subtitle),
    fragments: await downloadFragments(subtitle),
  }
}

export const bilibiliTrackSource: SubtitlesTrackSource = {
  currentKey: currentTrackKey,
  load: loadTrack,
}
