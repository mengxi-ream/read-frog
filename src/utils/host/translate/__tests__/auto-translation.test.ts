import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { shouldEnableAutoTranslation } from "../auto-translation"

function createConfig(pageOverrides: Partial<Config["translate"]["page"]> = {}, languageOverrides: Partial<Config["language"]> = {}): Config {
  return {
    ...DEFAULT_CONFIG,
    language: {
      ...DEFAULT_CONFIG.language,
      ...languageOverrides,
    },
    translate: {
      ...DEFAULT_CONFIG.translate,
      page: {
        ...DEFAULT_CONFIG.translate.page,
        autoTranslatePatterns: [],
        neverAutoTranslatePatterns: [],
        autoTranslateLanguages: [],
        ...pageOverrides,
      },
    },
  }
}

describe("shouldEnableAutoTranslation", () => {
  it("returns false when a never-auto-translate pattern matches even if the auto-translate pattern matches", async () => {
    const config = createConfig({
      autoTranslatePatterns: ["example.com"],
      neverAutoTranslatePatterns: ["example.com"],
    })

    await expect(shouldEnableAutoTranslation("https://example.com/story", "spa", config)).resolves.toBe(false)
  })

  it("returns false when a never-auto-translate pattern matches even if the detected language matches", async () => {
    const config = createConfig({
      neverAutoTranslatePatterns: ["example.com"],
      autoTranslateLanguages: ["spa"],
    })

    await expect(shouldEnableAutoTranslation("https://example.com/story", "spa", config)).resolves.toBe(false)
  })

  it("returns true when an auto-translate pattern matches and no never-auto-translate pattern matches", async () => {
    const config = createConfig({
      autoTranslatePatterns: ["example.com"],
      neverAutoTranslatePatterns: ["blocked.example"],
    })

    await expect(shouldEnableAutoTranslation("https://news.example.com/story", "spa", config)).resolves.toBe(true)
  })

  it("returns true when an auto-translate language matches and no never-auto-translate pattern matches", async () => {
    const config = createConfig({
      autoTranslateLanguages: ["eng"],
    }, {
      sourceCode: "auto",
    })

    await expect(shouldEnableAutoTranslation("https://example.com/story", "eng", config)).resolves.toBe(true)
  })

  it("returns false when no auto-translate rule matches", async () => {
    const config = createConfig({
      autoTranslatePatterns: ["example.com"],
      autoTranslateLanguages: ["spa"],
    })

    await expect(shouldEnableAutoTranslation("https://other.example/story", "eng", config)).resolves.toBe(false)
  })

  it("returns false for undetected language when no pattern matches", async () => {
    const config = createConfig({
      autoTranslateLanguages: ["spa" as LangCodeISO6393],
    })

    await expect(shouldEnableAutoTranslation("https://other.example/story", "und", config)).resolves.toBe(false)
  })
})
