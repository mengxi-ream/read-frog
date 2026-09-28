import type { VideoTranscriptUsagePool } from "@read-frog/api-contract"

/**
 * When the quota runs dry, "when does it come back" is the earliest date any
 * pool refills on. Keyed off `resetAt` rather than a pool id so a renamed or
 * added pool still answers: the launch gift carries only `expiresAt` because it
 * never refills, and a date that just runs out answers a different question.
 */
export function quotaResetAt(pools: VideoTranscriptUsagePool[] | undefined): string | null {
  const resets = (pools ?? [])
    .map((pool) => pool.resetAt)
    .filter((resetAt): resetAt is string => !!resetAt)
    .sort()
  return resets[0] ?? null
}

/**
 * Mirrors `TRANSCRIPTION_LAUNCH_BONUS_CUTOFF_AT` in the server's minute policy.
 * The grant is decided entirely server-side; this copy only decides whether to
 * advertise it, so drift shows up as a banner that stops (or keeps) offering
 * something — never as a wrong grant.
 */
export const LAUNCH_BONUS_CUTOFF_AT = "2026-09-14T00:00:00Z"

/**
 * The formatted cutoff while the launch offer is still open, else null. The
 * offer is time-boxed on purpose: past the cutoff the server stops issuing the
 * grant, so an ungated banner would age into a promise we no longer keep.
 *
 * The label is local, so a reader west of UTC sees the last date that is still
 * safe for them rather than one that has already passed by their clock. The
 * gate compares instants, so it flips at the same moment everywhere.
 */
export function launchBonusCutoffLabel(now: Date = new Date()): string | null {
  return now < new Date(LAUNCH_BONUS_CUTOFF_AT) ? formatQuotaDate(LAUNCH_BONUS_CUTOFF_AT) : null
}

/** Renders a pool's `resetAt` / `expiresAt` in the reader's own locale. */
export function formatQuotaDate(iso: string | null | undefined): string | null {
  if (!iso) {
    return null
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
}
