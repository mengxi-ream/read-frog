import type { FeatureUsageContext } from "@/types/analytics"
import { sendMessage } from "@/utils/message"

let pendingTogglePromise: Promise<void> | null = null

export async function requestPageTranslationToggle(
  enabled: boolean,
  analyticsContext?: FeatureUsageContext,
): Promise<boolean> {
  if (pendingTogglePromise) {
    return false
  }

  pendingTogglePromise = sendMessage("tryToSetEnablePageTranslationOnContentScript", {
    enabled,
    analyticsContext,
  }).finally(() => {
    pendingTogglePromise = null
  })

  await pendingTogglePromise
  return true
}
