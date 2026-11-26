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

type Metadata = z.infer<typeof metadataSchema>

function readMetadata(block: HTMLElement): Metadata | null {
  try {
    const parsed = metadataSchema.safeParse(JSON.parse(block.dataset.metadata ?? ""))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function findVideo(blockId: string): { block: HTMLElement; metadata: Metadata } | null {
  const block = [...document.querySelectorAll<HTMLElement>(EDX_VIDEO_SELECTOR)].find(
    (video) => video.dataset.blockId === blockId,
  )
  const metadata = block && readMetadata(block)
  return block && metadata ? { block, metadata } : null
}

// `transcriptLanguage` is the learner's language as of page load, and edX saves whichever
// language is fetched as their choice for every video, so follow the player's menu instead.
function readLanguage(block: HTMLElement, metadata: Metadata): string {
  return (
    block.querySelector<HTMLElement>(EDX_ACTIVE_LANGUAGE_SELECTOR)?.dataset.langCode ??
    metadata.transcriptLanguage
  )
}

// The language is part of the key, so picking another one in the player's menu loads that one.
// A block id never holds a space, so a space separates the two.
function currentKey(): string | null {
  const blockId = getEdxVideoId()
  if (blockId === null) return null
  const video = findVideo(blockId)
  return video ? `${blockId} ${readLanguage(video.block, video.metadata)}` : blockId
}

async function loadTrack(key: string): Promise<SubtitlesTrack> {
  const [blockId = "", language] = key.split(" ")
  const metadata = findVideo(blockId)?.metadata
  if (!metadata || !language) throw new TrackFileNotLoadedError()

  const url = new URL(
    metadata.transcriptTranslationUrl.replace("__lang__", language),
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
  currentKey,
  load: loadTrack,
}
