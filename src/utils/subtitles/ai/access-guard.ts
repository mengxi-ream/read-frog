import { authClient } from "@/utils/auth/auth-client"
import { i18n } from "@/utils/i18n"
import { isORPCForbiddenError, isORPCUnauthorizedError } from "@/utils/notebase/errors"
import { orpcClient } from "@/utils/orpc/client"
import { showSubtitlesErrorToast } from "@/utils/subtitles/toast"
import { formatQuotaDate, logInAction, quotaResetAt, upgradeAction } from "./entitlement"

function promptLogIn(): void {
  showSubtitlesErrorToast(i18n.t("subtitles.errors.aiLoginRequired"), logInAction())
}

function promptUpgrade(): void {
  showSubtitlesErrorToast(i18n.t("subtitles.errors.aiSubscriptionRequired"), upgradeAction())
}

export async function ensureSignedIn(): Promise<boolean> {
  const { data } = await authClient.getSession()
  if (!data?.user) {
    promptLogIn()
    return false
  }
  return true
}

/**
 * Checked before the subtitles flow starts, not after: switching the fetcher
 * tears down whatever session is playing, so a denial that arrives from
 * `create` has already cost the user their running translation. Clicking the
 * sparkles is often just curiosity — it must not destroy the track they were
 * watching.
 *
 * `getUsage` is auth-only on the server and answers a free account with
 * `plan: "free"` rather than a 403, so entitlement is read off the shape of a
 * successful response.
 */
export async function ensureAiSubtitlesEntitled(): Promise<boolean> {
  let usage: Awaited<ReturnType<typeof orpcClient.videoTranscript.getUsage>>
  try {
    usage = await orpcClient.videoTranscript.getUsage()
  } catch (error) {
    // A stale cached session can pass ensureSignedIn but 401 here.
    if (isORPCUnauthorizedError(error)) {
      promptLogIn()
      return false
    }
    // The launch server keeps getUsage auth-only, but a pre-launch one still
    // answers the beta allow-list with a 403. Either way it means the same
    // thing now: this account needs a plan.
    if (isORPCForbiddenError(error)) {
      promptUpgrade()
      return false
    }
    // Fail open: a network blip must not wall off a paying subscriber. `create`
    // stays the authority and answers with its own code.
    return true
  }

  // Strict equality, never `!== "pro" && !== "ultra"`: responses are not
  // runtime-validated, so an older server that omits `plan` must fall through
  // rather than read as free.
  if (usage.plan === "free") {
    promptUpgrade()
    return false
  }

  if (usage.remainingMinutes <= 0) {
    // `getUsage` is the only call that knows when the quota comes back, and it
    // is already in hand here — cheaper than asking again once `create` has
    // refused.
    const resetAt = formatQuotaDate(quotaResetAt(usage.pools))
    showSubtitlesErrorToast(
      resetAt
        ? i18n.t("subtitles.errors.aiQuotaExceededWithReset", [resetAt])
        : i18n.t("subtitles.errors.aiQuotaExceeded"),
      // Ultra is the top plan; there is nothing left to sell someone already on it.
      usage.plan === "ultra" ? undefined : upgradeAction(),
    )
    return false
  }

  return true
}

export async function ensureAiSubtitlesAccess(): Promise<boolean> {
  if (!(await ensureSignedIn())) {
    return false
  }
  return ensureAiSubtitlesEntitled()
}
