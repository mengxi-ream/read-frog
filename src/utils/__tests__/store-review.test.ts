import { describe, expect, it } from "vitest"
import { STORE_REVIEW_PROMPT_MIN_ACTIVE_DAYS, shouldShowStoreReviewPrompt } from "../store-review"

describe("shouldShowStoreReviewPrompt", () => {
  const threshold = STORE_REVIEW_PROMPT_MIN_ACTIVE_DAYS

  it("hides the prompt one day short of the threshold", () => {
    expect(shouldShowStoreReviewPrompt(threshold - 1, false)).toBe(false)
  })

  it("shows the prompt exactly at the threshold", () => {
    expect(shouldShowStoreReviewPrompt(threshold, false)).toBe(true)
  })

  it("shows the prompt past the threshold", () => {
    expect(shouldShowStoreReviewPrompt(threshold + 10, false)).toBe(true)
  })

  it("hides the prompt for someone who has never used a feature", () => {
    expect(shouldShowStoreReviewPrompt(0, false)).toBe(false)
  })

  it("stays hidden once dismissed, however many active days there are", () => {
    expect(shouldShowStoreReviewPrompt(threshold + 10, true)).toBe(false)
  })
})
