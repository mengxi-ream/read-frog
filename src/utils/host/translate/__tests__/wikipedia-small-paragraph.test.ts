// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://en.wikipedia.org/wiki/2026_Bangkok_floods" }
import type { Config } from "@/types/config/config"
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

function createConfig(mode: Config["pageTranslation"]["mode"] = "bilingual"): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  config.language.sourceCode = "eng"
  config.pageTranslation.mode = mode
  return config
}

beforeEach(() => {
  document.body.replaceChildren()
  mocks.translateTextForPage.mockReset()
  mocks.translateTextForPage.mockResolvedValue(undefined)
})

afterEach(() => {
  flushBatchedOperations()
})

describe.each(["bilingual", "translationOnly"] as const)("Wikipedia %s translation", (mode) => {
  it.each(["Background", "Impact", "References", "Wider area", "See also", "External links"])(
    "requests a translation for the table-of-contents entry %s",
    async (heading) => {
      const entry = document.createElement("div")
      entry.className = "vector-toc-text"
      const textNode = document.createTextNode(heading)
      entry.appendChild(textNode)
      document.body.appendChild(entry)

      await translateNodes([textNode], "walk-id", false, createConfig(mode))

      expect(mocks.translateTextForPage).toHaveBeenCalledOnce()
      expect(mocks.translateTextForPage.mock.calls[0]?.[0]).toBe(heading)
    },
  )
})

describe("Wikipedia short-text thresholds", () => {
  it("does not impose a site-specific threshold on short labels", async () => {
    await expect(shouldFilterSmallParagraph("Hi", createConfig())).resolves.toBe(false)
  })

  it("respects the global character threshold", async () => {
    const config = createConfig()
    config.pageTranslation.page.minCharactersPerNode = 4

    await expect(shouldFilterSmallParagraph("Hi", config)).resolves.toBe(true)
    await expect(shouldFilterSmallParagraph("Impact", config)).resolves.toBe(false)
  })

  it("respects the global word threshold", async () => {
    const config = createConfig()
    config.pageTranslation.page.minWordsPerNode = 2

    await expect(shouldFilterSmallParagraph("Background", config)).resolves.toBe(true)
    await expect(shouldFilterSmallParagraph("See also", config)).resolves.toBe(false)
  })

  it("allows a user rule to restore a stricter word threshold", async () => {
    const config = createConfig()
    config.siteRules.userRules = [
      { id: "wikipedia-threshold", matches: "*.wikipedia.org", minWords: 2 },
    ]

    await expect(shouldFilterSmallParagraph("Background", config)).resolves.toBe(true)
    await expect(shouldFilterSmallParagraph("See also", config)).resolves.toBe(false)
  })
})
