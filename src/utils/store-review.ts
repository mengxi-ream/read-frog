import { storage } from "#imports"

const DISMISSED_KEY = "local:storeReviewPromptDismissed" as const

/**
 * How many distinct days someone has to have successfully used a feature before the
 * popup asks them for a store review.
 *
 * Gating on engagement rather than on how long ago they installed: calendar time says
 * nothing about whether there is an opinion worth asking for, and someone who installed
 * a week ago and never translated anything has nothing to review.
 */
export const STORE_REVIEW_PROMPT_MIN_ACTIVE_DAYS = 3

export async function isStoreReviewPromptDismissed(): Promise<boolean> {
  return (await storage.getItem<boolean>(DISMISSED_KEY)) === true
}

/** Terminal: both the close button and a click through to the store land here. */
export async function dismissStoreReviewPrompt(): Promise<void> {
  await storage.setItem(DISMISSED_KEY, true)
}

export function shouldShowStoreReviewPrompt(activeDayCount: number, dismissed: boolean): boolean {
  return !dismissed && activeDayCount >= STORE_REVIEW_PROMPT_MIN_ACTIVE_DAYS
}
