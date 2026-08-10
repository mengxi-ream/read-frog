import { ORPCError } from "@orpc/client"
import { env } from "@/env"
import { sendMessage } from "@/utils/message"

// The server still gates AI transcription through the beta allow-list; swap this
// for the plan-required code once the backend switches to pro/ultra.
const UPGRADE_REQUIRED_ERROR_CODE = "VIDEO_TRANSCRIPTION_BETA_RESTRICTED"

export function isAiSubtitlesUpgradeRequiredError(error: unknown): boolean {
  return error instanceof ORPCError && error.code === UPGRADE_REQUIRED_ERROR_CODE
}

export function openPricingPage(): void {
  // Goes through the background: by the time a request has settled the user
  // gesture is gone, so window.open can be blocked in a content script.
  void sendMessage("openPage", {
    url: new URL("/pricing", env.WXT_WEBSITE_URL).toString(),
    active: true,
  })
}
