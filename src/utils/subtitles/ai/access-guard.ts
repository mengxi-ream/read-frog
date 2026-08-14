import { openLogIn } from "@/components/user-account-menu/shared"
import { authClient } from "@/utils/auth/auth-client"

export async function ensureSignedIn(): Promise<boolean> {
  const { data } = await authClient.getSession()
  if (!data?.user) {
    openLogIn()
    return false
  }
  return true
}

// Sign-in is the only client-side pre-check. The subscription wall lives on
// the server (`create` answers VIDEO_TRANSCRIPTION_SUBSCRIPTION_REQUIRED) and
// the request path renders it as an upgrade prompt — a client-side plan
// pre-flight would just be a second source of truth that can drift.
export async function ensureAiSubtitlesAccess(): Promise<boolean> {
  return ensureSignedIn()
}
