import type { SubtitlesTrack, SubtitlesTrackSource } from "../track"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { z } from "zod"
import {
  BILIBILI_POST_MESSAGE_TIMEOUT_MS,
  BILIBILI_SUBTITLES_REQUEST_TYPE,
  BILIBILI_SUBTITLES_RESPONSE_TYPE,
} from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"
import { NoSubtitlesError, OverlaySubtitlesError } from "@/utils/subtitles/errors"
import { getBilibiliPartId } from "@/utils/subtitles/video-id"
import { postMessageRequest } from "../post-message-request"

const bilibiliSubtitlesResponseSchema = z.object({
  type: z.string(),
  requestId: z.string(),
  cid: z.number().nullable(),
  subtitles: z.array(z.unknown()).nullable(),
})

export type BilibiliSubtitlesResponse = z.infer<typeof bilibiliSubtitlesResponseSchema>

const subtitleEntrySchema = z.object({ lan: z.string(), subtitle_url: z.string().nonempty() })

type SubtitleEntry = z.infer<typeof subtitleEntrySchema>

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

// Bilibili names its AI subtitles `ai-<lang>`; the uploader's own are the better source.
function pickSubtitle(subtitles: unknown[]): SubtitleEntry | null {
  const entries = subtitles.flatMap((subtitle) => {
    const parsed = subtitleEntrySchema.safeParse(subtitle)
    return parsed.success ? [parsed.data] : []
  })
  return entries.find((entry) => !entry.lan.startsWith("ai-")) ?? entries[0] ?? null
}

async function downloadFragments(subtitle: SubtitleEntry): Promise<SubtitlesFragment[]> {
  // `subtitle_url` comes without a scheme, as `//host/path`.
  const response = await fetch(new URL(subtitle.subtitle_url, window.location.href)).catch(
    () => null,
  )
  const parsed = subtitleFileSchema.safeParse(
    response?.ok ? await response.json().catch(() => null) : null,
  )
  if (!parsed.success) {
    throw new OverlaySubtitlesError(i18n.t("subtitles.errors.trackFileNotLoaded"))
  }

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
  if (!response.subtitles) {
    throw new OverlaySubtitlesError(i18n.t("subtitles.errors.trackFileNotLoaded"))
  }

  // Bilibili also sends an empty list to a signed-out viewer; signing in is theirs to do.
  const subtitle = pickSubtitle(response.subtitles)
  if (!subtitle) throw new NoSubtitlesError()

  return {
    language: subtitle.lan.replace(/^ai-/, ""),
    fragments: await downloadFragments(subtitle),
  }
}

export const bilibiliTrackSource: SubtitlesTrackSource = {
  currentKey: getBilibiliPartId,
  load: loadTrack,
}
