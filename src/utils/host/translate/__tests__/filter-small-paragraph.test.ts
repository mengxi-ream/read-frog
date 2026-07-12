// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://x.com/home" }
import type { Config } from "@/types/config/config"
import type { SiteRule } from "@/types/config/site-rules"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { flushBatchedOperations } from "@/utils/host/dom/batch-dom"
import { translateNodes } from "../core/translation-modes"
import { shouldFilterSmallParagraph } from "../filter-small-paragraph"

const mocks = vi.hoisted(() => ({
  translateTextForPage: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPage: mocks.translateTextForPage,
}))

function createConfig({
  mode = "bilingual",
  minCharacters = 0,
  minWords = 0,
  userRules = [],
}: {
  mode?: Config["translate"]["mode"]
  minCharacters?: number
  minWords?: number
  userRules?: SiteRule[]
} = {}): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  config.language.sourceCode = "eng"
  config.translate.mode = mode
  config.translate.page.minCharactersPerNode = minCharacters
  config.translate.page.minWordsPerNode = minWords
  config.siteRules.userRules = userRules
  return config
}

function userThresholdRule(minCharacters: number, minWords: number): SiteRule {
  return {
    id: `user-threshold-${minCharacters}-${minWords}`,
    matches: "x.com",
    minCharacters,
    minWords,
  }
}

beforeEach(() => {
  document.body.replaceChildren()
  mocks.translateTextForPage.mockReset()
  mocks.translateTextForPage.mockResolvedValue(undefined)
})

afterEach(() => {
  flushBatchedOperations()
})

describe("shouldFilterSmallParagraph", () => {
  it("filters a candidate containing only an @handle", async () => {
    await expect(shouldFilterSmallParagraph(" @openai ", createConfig())).resolves.toBe(true)
  })

  it("does not filter a sentence merely because it contains an @handle", async () => {
    await expect(shouldFilterSmallParagraph("Hello @openai", createConfig())).resolves.toBe(false)
  })

  it("lets the Twitter built-in thresholds weaken stricter global defaults", async () => {
    const config = createConfig({ minCharacters: 100, minWords: 10 })

    await expect(shouldFilterSmallParagraph("Hi", config)).resolves.toBe(false)
  })

  it("lets a user site rule strengthen the Twitter thresholds", async () => {
    const config = createConfig({
      userRules: [userThresholdRule(10, 2)],
    })

    await expect(shouldFilterSmallParagraph("Hello", config)).resolves.toBe(true)
  })

  it("lets a user site rule weaken the Twitter thresholds", async () => {
    const config = createConfig({
      minCharacters: 100,
      minWords: 10,
      userRules: [userThresholdRule(1, 1)],
    })

    await expect(shouldFilterSmallParagraph("I", config)).resolves.toBe(false)
  })

  it("lets a user site rule disable both thresholds with zero", async () => {
    const config = createConfig({
      minCharacters: 100,
      minWords: 10,
      userRules: [userThresholdRule(0, 0)],
    })

    await expect(shouldFilterSmallParagraph("!", config)).resolves.toBe(false)
  })
})

describe.each(["bilingual", "translationOnly"] as const)("%s translation", (mode) => {
  it("does not request a translation for a pure @handle", async () => {
    const container = document.createElement("div")
    const textNode = document.createTextNode("@openai")
    container.appendChild(textNode)
    document.body.appendChild(container)

    await translateNodes([textNode], "walk-id", false, createConfig({ mode }))

    expect(mocks.translateTextForPage).not.toHaveBeenCalled()
  })

  it("still requests a translation for a sentence containing an @handle", async () => {
    const container = document.createElement("div")
    const textNode = document.createTextNode("Hello @openai")
    container.appendChild(textNode)
    document.body.appendChild(container)

    await translateNodes([textNode], "walk-id", false, createConfig({ mode }))

    expect(mocks.translateTextForPage).toHaveBeenCalledOnce()
    expect(mocks.translateTextForPage).toHaveBeenCalledWith(
      "Hello @openai",
      mode === "translationOnly" ? "html" : "plain",
    )
  })
})
