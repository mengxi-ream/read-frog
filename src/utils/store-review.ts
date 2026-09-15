import { storage } from "#imports"

export const STORE_REVIEW_PROMPT_DISMISSED_STORAGE_KEY = "storeReviewPromptDismissed"

/**
 * How many distinct days someone has to have successfully used a feature before the
 * popup asks them for a store review.
 *
 * Gating on engagement rather than on how long ago they installed: calendar time says
 * nothing about whether there is an opinion worth asking for, and someone who installed
 * a week ago and never translated anything has nothing to review.
 */
export const STORE_REVIEW_PROMPT_MIN_ACTIVE_DAYS = 3

const DISMISSED_KEY = `local:${STORE_REVIEW_PROMPT_DISMISSED_STORAGE_KEY}` as const

export async function isStoreReviewPromptDismissed(): Promise<boolean> {
  return (await storage.getItem<boolean>(DISMISSED_KEY)) === true
}

/** Terminal: both the close button and a click through to the store land here. */
export async function dismissStoreReviewPrompt(): Promise<void> {
  await storage.setItem(DISMISSED_KEY, true)
}

export function shouldShowStoreReviewPrompt({
  activeDayCount,
  dismissed,
}: {
  activeDayCount: number
  dismissed: boolean
}): boolean {
  if (dismissed) return false
  return activeDayCount >= STORE_REVIEW_PROMPT_MIN_ACTIVE_DAYS
}
