import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { ORPCError, safe } from "@orpc/client"
import { i18n } from "@/utils/i18n"
import { orpcClient } from "@/utils/orpc/client"
import { OverlaySubtitlesError, ToastSubtitlesError } from "@/utils/subtitles/errors"

export interface AiSubtitlesContext {
  videoId: string
  url: string
}

interface VideoTranscriptJob {
  id: string
  status: string
  detectedLanguage: string | null
}

const POLL_INTERVAL_MS = 1_000
const POLL_TIMEOUT_MS = 5 * 60 * 1_000
const MS_PER_SECOND = 1_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError")
  }
}

async function pollUntilCompleted(
  initial: VideoTranscriptJob,
  signal: AbortSignal | undefined,
): Promise<VideoTranscriptJob> {
  if (initial.status === "completed") {
    return initial
  }
  if (initial.status === "failed") {
    throw new OverlaySubtitlesError(i18n.t("subtitles.errors.aiServiceUnavailable"))
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    throwIfAborted(signal)
    await sleep(POLL_INTERVAL_MS)
    throwIfAborted(signal)

    const job: VideoTranscriptJob = await orpcClient.videoTranscript.get({ id: initial.id })
    if (job.status === "completed") {
      return job
    }
    if (job.status === "failed") {
      throw new OverlaySubtitlesError(i18n.t("subtitles.errors.aiServiceUnavailable"))
    }
  }

  throw new OverlaySubtitlesError(i18n.t("subtitles.errors.fetchSubTimeout"))
}

export async function requestAiSubtitles(
  ctx: AiSubtitlesContext,
  opts?: { signal?: AbortSignal },
): Promise<{ segments: SubtitlesFragment[]; detectedLanguage: string }> {
  const { url } = ctx
  const signal = opts?.signal

  throwIfAborted(signal)

  const { error, data } = await safe(orpcClient.videoTranscript.create({ url }))
  if (error) {
    // Login + beta are pre-checked before create is called, so only quota (not pre-checked)
    // and unexpected failures can reach here.
    if (error instanceof ORPCError && error.code === "VIDEO_TRANSCRIPTION_QUOTA_EXCEEDED") {
      throw new ToastSubtitlesError(i18n.t("subtitles.errors.aiQuotaExceeded"))
    }
    throw new OverlaySubtitlesError(i18n.t("subtitles.errors.aiRequestFailed"))
  }

  const completed = await pollUntilCompleted(data, signal)

  throwIfAborted(signal)

  const subtitles = await orpcClient.videoTranscript.getSubtitles({ id: completed.id })

  const segments: SubtitlesFragment[] = subtitles.segments.map(
    (segment: { start: number; end: number; text: string }) => ({
      text: segment.text,
      start: segment.start * MS_PER_SECOND,
      end: segment.end * MS_PER_SECOND,
    }),
  )

  return {
    segments,
    detectedLanguage: subtitles.detectedLanguage ?? completed.detectedLanguage ?? "",
  }
}
