import type { VideoTranscriptStatus } from "@read-frog/api-contract"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { ORPCError, safe } from "@orpc/client"
import { env } from "@/env"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { orpcClient } from "@/utils/orpc/client"
import { OverlaySubtitlesError, ToastSubtitlesError } from "@/utils/subtitles/errors"

export interface AiSubtitlesContext {
  videoId: string
  url: string
  /** Player-reported duration; an untrusted admission pre-check, never the billing basis. */
  durationSec: number
}

interface VideoTranscriptJob {
  id: string
  // The contract's status union, so a renamed job state fails the build here
  // instead of silently never matching "completed"/"failed" below.
  status: VideoTranscriptStatus
  detectedLanguage: string | null
}

const POLL_INTERVAL_MS = 1_000
const POLL_BASE_TIMEOUT_MS = 8 * 60 * 1_000
const POLL_MAX_TIMEOUT_MS = 20 * 60 * 1_000
const MS_PER_SECOND = 1_000

/**
 * Transcription wall time barely tracks video length (chunks run on Azure in
 * parallel; a 20-minute video typically settles in ~1 minute) — the dominant
 * variance is audio-download flakiness plus the worker's retry chain, which is
 * why the base term is the big one and the per-length term is small.
 */
function pollTimeoutMs(durationSec: number): number {
  return Math.min(POLL_MAX_TIMEOUT_MS, POLL_BASE_TIMEOUT_MS + durationSec * 100)
}

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
  durationSec: number,
  signal: AbortSignal | undefined,
): Promise<VideoTranscriptJob> {
  if (initial.status === "completed") {
    return initial
  }
  if (initial.status === "failed") {
    throw new OverlaySubtitlesError(i18n.t("subtitles.errors.aiServiceUnavailable"))
  }

  const startedAt = Date.now()
  const deadline = startedAt + pollTimeoutMs(durationSec)

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

  // The deadline bounds this wait, not the job: the server keeps transcribing
  // and caches the result, and a later click resumes the same row. So report
  // "still working" as a toast — never a failure overlay.
  throw new ToastSubtitlesError(i18n.t("subtitles.errors.aiStillProcessing"))
}

export async function requestAiSubtitles(
  ctx: AiSubtitlesContext,
  opts?: { signal?: AbortSignal },
): Promise<{ segments: SubtitlesFragment[]; detectedLanguage: string }> {
  const { url, durationSec } = ctx
  const signal = opts?.signal

  throwIfAborted(signal)

  const { error, data } = await safe(orpcClient.videoTranscript.create({ url, durationSec }))
  if (error) {
    // Only sign-in is pre-checked before create; the plan wall and the quota
    // wall are server decisions surfaced here by error code.
    if (error instanceof ORPCError && error.code === "VIDEO_TRANSCRIPTION_QUOTA_EXCEEDED") {
      throw new ToastSubtitlesError(i18n.t("subtitles.errors.aiQuotaExceeded"))
    }
    if (error instanceof ORPCError && error.code === "VIDEO_TRANSCRIPTION_SUBSCRIPTION_REQUIRED") {
      // Content scripts cannot use chrome.tabs — route through the background.
      void sendMessage("openPage", {
        url: new URL("/pricing", env.WXT_WEBSITE_URL).toString(),
        active: true,
      })
      throw new ToastSubtitlesError(i18n.t("subtitles.errors.aiSubscriptionRequired"))
    }
    if (error instanceof ORPCError && error.code === "VIDEO_TRANSCRIPTION_PAYMENT_REQUIRED") {
      // Dunning, not cancellation: they already pay, the card just failed. Send
      // them to the app (billing lives in its settings dialog) rather than to
      // pricing, which would invite an existing subscriber to subscribe again.
      void sendMessage("openPage", {
        url: new URL("/home", env.WXT_WEBSITE_URL).toString(),
        active: true,
      })
      throw new ToastSubtitlesError(i18n.t("subtitles.errors.aiPaymentRequired"))
    }
    if (error instanceof ORPCError && error.code === "VIDEO_TRANSCRIPTION_UNSUPPORTED_LENGTH") {
      // A property of the video, not of the account — no upgrade and no waiting
      // for the quota to reset makes this one work, so offer neither.
      throw new ToastSubtitlesError(i18n.t("subtitles.errors.aiVideoTooLong"))
    }
    throw new OverlaySubtitlesError(i18n.t("subtitles.errors.aiRequestFailed"))
  }

  const completed = await pollUntilCompleted(data, durationSec, signal)

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
