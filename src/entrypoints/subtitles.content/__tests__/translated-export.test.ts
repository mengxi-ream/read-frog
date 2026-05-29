import { describe, expect, it, vi } from "vitest"
import {
  reportTranslatedExportTranslationProgress,
  TRANSLATED_EXPORT_PREPARING_PROGRESS_MAX,
} from "../translated-export"

describe("translated export progress", () => {
  it("maps translation progress into the post-preparation range", () => {
    const onProgress = vi.fn()

    reportTranslatedExportTranslationProgress(5, 11, onProgress)

    expect(onProgress).toHaveBeenCalledWith({
      phase: "translating",
      progress: TRANSLATED_EXPORT_PREPARING_PROGRESS_MAX + Math.round((5 / 11) * (100 - TRANSLATED_EXPORT_PREPARING_PROGRESS_MAX)),
    })
  })
})
