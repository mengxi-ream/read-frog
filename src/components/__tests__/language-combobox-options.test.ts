import type { LanguageItem } from "../language-combobox-options"
import { describe, expect, it } from "vitest"
import { filterLanguage } from "../language-combobox-options"

describe("filterLanguage", () => {
  it("does not throw when a legacy language item has no name", () => {
    const item = {
      value: "eng",
      label: "English (English)",
    } as LanguageItem

    expect(() => filterLanguage(item, "eng")).not.toThrow()
    expect(filterLanguage(item, "eng")).toBe(true)
    expect(filterLanguage(item, "English")).toBe(true)
    expect(filterLanguage(item, "zzz")).toBe(false)
  })
})
