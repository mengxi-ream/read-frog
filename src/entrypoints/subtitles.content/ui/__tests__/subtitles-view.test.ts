// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import { shouldPlaceTranslationAbove } from "../subtitles-view"

describe("subtitles view", () => {
  it("keeps original text above translation on Netflix", () => {
    expect(shouldPlaceTranslationAbove("above", "www.netflix.com")).toBe(false)
  })

  it("respects translation position on other sites", () => {
    expect(shouldPlaceTranslationAbove("above", "www.youtube.com")).toBe(true)
    expect(shouldPlaceTranslationAbove("below", "www.youtube.com")).toBe(false)
  })
})
