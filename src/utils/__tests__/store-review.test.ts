import { describe, expect, it } from "vitest"
import { STORE_REVIEW_PROMPT_MIN_ACTIVE_DAYS, shouldShowStoreReviewPrompt } from "../store-review"

describe("shouldShowStoreReviewPrompt", () => {
  const threshold = STORE_REVIEW_PROMPT_MIN_ACTIVE_DAYS

  it("hides the prompt one day short of the threshold", () => {
    expect(shouldShowStoreReviewPrompt({ activeDayCount: threshold - 1, dismissed: false })).toBe(
      false,
    )
  })

  it("shows the prompt exactly at the threshold", () => {
    expect(shouldShowStoreReviewPrompt({ activeDayCount: threshold, dismissed: false })).toBe(true)
  })

  it("shows the prompt past the threshold", () => {
    expect(shouldShowStoreReviewPrompt({ activeDayCount: threshold + 10, dismissed: false })).toBe(
      true,
    )
  })

  it("hides the prompt for someone who has never used a feature", () => {
    expect(shouldShowStoreReviewPrompt({ activeDayCount: 0, dismissed: false })).toBe(false)
  })

  it("stays hidden once dismissed, however many active days there are", () => {
    expect(shouldShowStoreReviewPrompt({ activeDayCount: threshold + 10, dismissed: true })).toBe(
      false,
    )
  })
})
