import { describe, expect, it } from "vitest"
import { getLanguageLabel } from "../language-labels"

describe("getLanguageLabel", () => {
  it("combines the localized language name with the native language name", () => {
    expect(getLanguageLabel("jpn")).toBe("languages.jpn (日本語)")
  })
})
