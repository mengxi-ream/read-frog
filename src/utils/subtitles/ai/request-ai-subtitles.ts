import type { VideoTranscriptStatus } from "@read-frog/api-contract"
import type { SubtitlesError } from "@/utils/subtitles/errors"
import type { SubtitlesFragment } from "@/utils/subtitles/types"
import { safe } from "@orpc/client"
import { i18n } from "@/utils/i18n"
import { isORPCPublicAppError } from "@/utils/notebase/errors"
import { orpcClient } from "@/utils/orpc/client"
import { OverlaySubtitlesError, ToastSubtitlesError } from "@/utils/subtitles/errors"
import { billingAction, upgradeAction } from "./entitlement"

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

/**
 * Turns a transcription endpoint's refusal into something the player can say.
 * Shared by `create`, the poll's `get` and `getSubtitles` — all three are
 * behind the same entitlement middleware, so any of them can answer with the
 * plan wall once a subscription lapses mid-flight.
 *
 * Walls the user can act on become toasts carrying a button; everything else
 * is an overlay. Nothing here navigates on its own.
 */
function mapTranscriptError(error: unknown): SubtitlesError {
  if (isORPCPublicAppError(error, "VIDEO_TRANSCRIPTION_SUBSCRIPTION_REQUIRED")) {
    return new ToastSubtitlesError(
      i18n.t("subtitles.errors.aiSubscriptionRequired"),
      upgradeAction(),
    )
  }
  if (isORPCPublicAppError(error, "VIDEO_TRANSCRIPTION_PAYMENT_REQUIRED")) {
    return new ToastSubtitlesError(i18n.t("subtitles.errors.aiPaymentRequired"), billingAction())
  }
  if (isORPCPublicAppError(error, "VIDEO_TRANSCRIPTION_QUOTA_EXCEEDED")) {
    // The pre-flight normally catches this and can name the reset date; by the
    // time the server refuses, only it knows the remainder and we do not.
    return new ToastSubtitlesError(i18n.t("subtitles.errors.aiQuotaExceeded"), upgradeAction())
  }
  if (isORPCPublicAppError(error, "VIDEO_TRANSCRIPTION_UNSUPPORTED_LENGTH")) {
    // A property of the video, not of the account — no upgrade and no waiting
    // for the quota to reset makes this one work, so offer neither.
    return new ToastSubtitlesError(i18n.t("subtitles.errors.aiVideoTooLong"))
  }
  if (isORPCPublicAppError(error, "VIDEO_TRANSCRIPT_NOT_READY")) {
    // The job is fine, the file just is not written yet.
    return new ToastSubtitlesError(i18n.t("subtitles.errors.aiStillProcessing"))
  }
  // NOT_FOUND and everything else: a real failure — and never the server's
  // untranslated English, which is what an unmapped ORPCError would render.
  return new OverlaySubtitlesError(i18n.t("subtitles.errors.aiRequestFailed"))
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

    const { error, data: job } = await safe(orpcClient.videoTranscript.get({ id: initial.id }))
    if (error) {
      throw mapTranscriptError(error)
    }
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
    // Sign-in, plan and quota are pre-checked before create is called, so the
    // walls reaching here are races (a subscription that lapsed since the
    // pre-flight) and the codes the pre-flight cannot see, like an unsupported
    // video length.
    throw mapTranscriptError(error)
  }

  const completed = await pollUntilCompleted(data, durationSec, signal)

  throwIfAborted(signal)

  const { error: subtitlesError, data: subtitles } = await safe(
    orpcClient.videoTranscript.getSubtitles({ id: completed.id }),
  )
  if (subtitlesError) {
    throw mapTranscriptError(subtitlesError)
  }

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
