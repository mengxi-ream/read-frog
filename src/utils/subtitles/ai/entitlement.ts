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
