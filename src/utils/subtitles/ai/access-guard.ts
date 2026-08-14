import { ORPCError } from "@orpc/client"
import { VIDEO_TRANSCRIPTION_BETA_FEATURE_KEY } from "@read-frog/definitions"
import { openLogIn } from "@/components/user-account-menu/shared"
import { authClient } from "@/utils/auth/auth-client"
import { VIDEO_TRANSCRIPTION_APPLY_URL } from "@/utils/constants/subtitles"
import { orpcClient } from "@/utils/orpc/client"

export async function ensureSignedIn(): Promise<boolean> {
  const { data } = await authClient.getSession()
  if (!data?.user) {
    openLogIn()
    return false
  }
  return true
}

export async function ensureBetaAllowed(): Promise<boolean> {
  try {
    const { allowed } = await orpcClient.betaAccess.status({
      featureKey: VIDEO_TRANSCRIPTION_BETA_FEATURE_KEY,
    })
    if (!allowed) {
      // silently send them to the application form; content scripts can't use chrome.tabs
      window.open(VIDEO_TRANSCRIPTION_APPLY_URL, "_blank")
      return false
    }
    return true
  } catch (error) {
    // A stale cached session can pass ensureSignedIn but 401 here; treat as unauthenticated.
    if (error instanceof ORPCError && error.status === 401) {
      openLogIn()
      return false
    }
    return true
  }
}

export async function ensureAiSubtitlesAccess(): Promise<boolean> {
  if (!(await ensureSignedIn())) {
    return false
  }
  if (!(await ensureBetaAllowed())) {
    return false
  }
  return true
}
