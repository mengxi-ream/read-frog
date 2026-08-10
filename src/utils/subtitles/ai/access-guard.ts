import { ORPCError } from "@orpc/client"
import { openLogIn } from "@/components/user-account-menu/shared"
import { authClient } from "@/utils/auth/auth-client"
import { orpcClient } from "@/utils/orpc/client"
import { isAiSubtitlesUpgradeRequiredError, openPricingPage } from "./entitlement"

export async function ensureSignedIn(): Promise<boolean> {
  const { data } = await authClient.getSession()
  if (!data?.user) {
    openLogIn()
    return false
  }
  return true
}

export async function ensureAiSubtitlesEntitled(): Promise<boolean> {
  try {
    await orpcClient.videoTranscript.getUsage()
    return true
  } catch (error) {
    // A stale cached session can pass ensureSignedIn but 401 here; treat as unauthenticated.
    if (error instanceof ORPCError && error.status === 401) {
      openLogIn()
      return false
    }
    if (isAiSubtitlesUpgradeRequiredError(error)) {
      // Deliberately silent: the subtitles flow never starts, so the track the
      // user was already watching is left alone.
      openPricingPage()
      return false
    }
    return true
  }
}

export async function ensureAiSubtitlesAccess(): Promise<boolean> {
  if (!(await ensureSignedIn())) {
    return false
  }
  if (!(await ensureAiSubtitlesEntitled())) {
    return false
  }
  return true
}
