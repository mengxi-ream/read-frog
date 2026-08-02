// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { isForceInlineTranslation, isShortInlineTranslationText } from "../translation-utils"

describe("isShortInlineTranslationText", () => {
  it.each([
    ["Introduction", true],
    ["one two three four", true],
    ["a".repeat(24), true],
    ["短标签", true],
    ["a".repeat(25), false],
    ["one two three four five", false],
    ["Introduction\nTitle", false],
    ["Introduction\rTitle", false],
    ["", false],
    ["   ", false],
  ])("classifies %j as %s", (text, expected) => {
    expect(isShortInlineTranslationText(text)).toBe(expected)
  })

  it("normalizes surrounding and repeated horizontal whitespace", () => {
    expect(isShortInlineTranslationText("  one\t two   three four  ")).toBe(true)
  })
})

describe("isForceInlineTranslation", () => {
  function configWithRule(rule: Config["siteRules"]["userRules"][number]): Config {
    const config = structuredClone(DEFAULT_CONFIG)
    config.siteRules = { userRules: [rule], disabledBuiltInRules: [] }
    return config
  }

  it("forces inline for the default tag set without config", () => {
    expect(isForceInlineTranslation(document.createElement("a"), "block")).toBe(true)
    expect(isForceInlineTranslation(document.createElement("div"), "block")).toBe(false)
  })

  it("honors forceInlineTranslationTags overrides from the effective site rule", () => {
    Object.defineProperty(window, "location", {
      value: new URL("https://tagset-example.org/some/path"),
      writable: true,
    })
    const config = configWithRule({
      id: "tagset",
      matches: "tagset-example.org",
      "forceInlineTranslationTags.add": ["ABBR"],
      "forceInlineTranslationTags.remove": ["SPAN"],
    })

    expect(isForceInlineTranslation(document.createElement("abbr"), "block", config)).toBe(true)
    expect(isForceInlineTranslation(document.createElement("span"), "block", config)).toBe(false)
    // config-less calls keep the shipped default
    expect(isForceInlineTranslation(document.createElement("span"), "block")).toBe(true)
  })
})
