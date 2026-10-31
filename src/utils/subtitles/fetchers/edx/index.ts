import type { SubtitlesTrack, SubtitlesTrackSource } from "../track"
import { z } from "zod"
import {
  EDX_ACTIVE_LANGUAGE_SELECTOR,
  EDX_LAST_LINE_DURATION_MS,
  EDX_VIDEO_SELECTOR,
} from "@/utils/constants/subtitles"
import { NoSubtitlesError, TrackFileNotLoadedError } from "@/utils/subtitles/errors"
import { getEdxVideoId } from "@/utils/subtitles/video-id"
import { fetchWithRetry, readJson } from "../fetch-with-retry"

const metadataSchema = z.object({
  transcriptTranslationUrl: z.string().nonempty(),
  transcriptLanguage: z.string(),
})

// Times in milliseconds; edX's own player reads only `start` and `text`, so `end` may be missing.
const transcriptSchema = z
  .object({
    start: z.array(z.number()),
    end: z.array(z.number()).optional(),
    text: z.array(z.string()),
  })
  .refine(
    ({ start, end, text }) => start.length === text.length && (!end || end.length === text.length),
  )

function readMetadata(block: HTMLElement): unknown {
  try {
    return JSON.parse(block.dataset.metadata ?? "")
  } catch {
    return null
  }
}

async function loadTrack(blockId: string): Promise<SubtitlesTrack> {
  const block = [...document.querySelectorAll<HTMLElement>(EDX_VIDEO_SELECTOR)].find(
    (video) => video.dataset.blockId === blockId,
  )
  if (!block) throw new TrackFileNotLoadedError()
  const metadata = metadataSchema.safeParse(readMetadata(block))
  if (!metadata.success) throw new TrackFileNotLoadedError()

  // `transcriptLanguage` is the learner's language as of page load, and edX saves whichever
  // language is fetched as their choice for every video, so follow the player's menu instead.
  const language =
    block.querySelector<HTMLElement>(EDX_ACTIVE_LANGUAGE_SELECTOR)?.dataset.langCode ??
    metadata.data.transcriptLanguage
  const url = new URL(
    metadata.data.transcriptTranslationUrl.replace("__lang__", language),
    window.location.origin,
  )
  const response = await fetchWithRetry(url)
  if (response?.status === 404) throw new NoSubtitlesError()
  const transcript = transcriptSchema.safeParse(await readJson(response))
  if (!transcript.success) throw new TrackFileNotLoadedError()

  const { start, end, text } = transcript.data
  return {
    language,
    fragments: start.map((lineStart, index) => ({
      text: text[index] ?? "",
      start: lineStart,
      end: end?.[index] ?? start[index + 1] ?? lineStart + EDX_LAST_LINE_DURATION_MS,
    })),
  }
}

export const edxTrackSource: SubtitlesTrackSource = {
  currentKey: getEdxVideoId,
  load: loadTrack,
}
