import type { VideoTranscriptUsagePool } from "@read-frog/api-contract"
import type { SubtitlesErrorAction } from "@/utils/subtitles/errors"
import { env } from "@/env"
import { i18n } from "@/utils/i18n"

/**
 * The single place that knows where an AI-subtitles denial sends the user and
 * what its button says. Every wall — the click-time pre-flight and the server's
 * own error codes — builds its call to action from here, so moving a landing
 * page is one edit rather than a grep across the subtitles pipeline.
 */

function websiteUrl(path: string): string {
  return new URL(path, env.WXT_WEBSITE_URL).toString()
}

export function pricingUrl(): string {
  return websiteUrl("/pricing")
}

/** Billing lives in the app's settings dialog, not on the marketing page. */
export function billingUrl(): string {
  return websiteUrl("/home")
}

export function logInUrl(): string {
  return websiteUrl("/log-in")
}

export function upgradeAction(): SubtitlesErrorAction {
  return { label: i18n.t("action.upgrade"), url: pricingUrl() }
}

/**
 * Dunning, not cancellation: they already pay and the card just failed, so
 * sending them to pricing would invite an existing subscriber to subscribe
 * again — and a button reading "Upgrade" would say the wrong thing to someone
 * who already did.
 */
export function billingAction(): SubtitlesErrorAction {
  return { label: i18n.t("action.updatePayment"), url: billingUrl() }
}

export function logInAction(): SubtitlesErrorAction {
  return { label: i18n.t("account.login"), url: logInUrl() }
}

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
