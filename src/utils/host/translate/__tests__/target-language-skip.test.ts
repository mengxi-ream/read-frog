// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { flushBatchedOperations } from "@/utils/host/dom/batch-dom"
import { translateNodes } from "../core/translation-modes"
import { shouldSkipAsTargetLanguage } from "../target-language-skip"

const mocks = vi.hoisted(() => ({
  translateTextForPage: vi.fn<(...args: any[]) => any>(),
  detectLanguage: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPage: mocks.translateTextForPage,
}))

vi.mock("@/utils/content/language", () => ({
  detectLanguage: mocks.detectLanguage,
}))

const LONG_CHINESE =
  "这是一个足够长的中文段落，用来触发语言检测逻辑，长度必须超过五十个字符才可以，所以这里再补充一些文字凑够长度。"
const LONG_ENGLISH =
  "This is a sufficiently long English paragraph used to trigger the language detection logic in tests."

function createConfig({
  mode = "bilingual",
  enableSkip = true,
  targetCode = "cmn",
}: {
  mode?: Config["translate"]["mode"]
  enableSkip?: boolean
  targetCode?: Config["language"]["targetCode"]
} = {}): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  config.translate.mode = mode
  config.translate.page.enableTargetLanguageSkip = enableSkip
  config.translate.page.minCharactersPerNode = 0
  config.translate.page.minWordsPerNode = 0
  config.language.targetCode = targetCode
  return config
}

beforeEach(() => {
  document.body.replaceChildren()
  mocks.translateTextForPage.mockReset().mockResolvedValue(undefined)
  mocks.detectLanguage.mockReset().mockResolvedValue(null)
})

afterEach(() => {
  flushBatchedOperations()
})

describe("shouldSkipAsTargetLanguage", () => {
  it("returns false without calling detection when the skip flag is off", async () => {
    await expect(
      shouldSkipAsTargetLanguage(LONG_CHINESE, createConfig({ enableSkip: false })),
    ).resolves.toBe(false)
    expect(mocks.detectLanguage).not.toHaveBeenCalled()
  })

  it("returns false without calling detection for short text", async () => {
    await expect(shouldSkipAsTargetLanguage("你好", createConfig())).resolves.toBe(false)
    expect(mocks.detectLanguage).not.toHaveBeenCalled()
  })

  it("returns true when the detected language matches the target", async () => {
    mocks.detectLanguage.mockResolvedValue("cmn")
    await expect(shouldSkipAsTargetLanguage(LONG_CHINESE, createConfig())).resolves.toBe(true)
    expect(mocks.detectLanguage).toHaveBeenCalledWith(expect.any(String), { enableLLM: false })
  })

  it("returns false when the detected language differs or is unknown", async () => {
    mocks.detectLanguage.mockResolvedValue("eng")
    await expect(shouldSkipAsTargetLanguage(LONG_ENGLISH, createConfig())).resolves.toBe(false)
    mocks.detectLanguage.mockResolvedValue(null)
    await expect(shouldSkipAsTargetLanguage(LONG_ENGLISH, createConfig())).resolves.toBe(false)
  })
})

describe.each(["bilingual", "translationOnly"] as const)("%s translation", (mode) => {
  it("never inserts a wrapper for an already-target-language paragraph", async () => {
    mocks.detectLanguage.mockImplementation(async (text: string) =>
      /[一-鿿]/.test(text) ? "cmn" : "eng",
    )
    const container = document.createElement("div")
    const textNode = document.createTextNode(LONG_CHINESE)
    container.appendChild(textNode)
    document.body.appendChild(container)

    await translateNodes([textNode], "walk-id", false, createConfig({ mode }))
    flushBatchedOperations()

    expect(mocks.translateTextForPage).not.toHaveBeenCalled()
    // The old behavior inserted a wrapper+spinner and then removed it; now the
    // DOM must never contain one at all.
    expect(document.querySelectorAll(".read-frog-translated-content-wrapper").length).toBe(0)
  })

  it("still requests a translation for a different-language paragraph", async () => {
    mocks.detectLanguage.mockImplementation(async (text: string) =>
      /[一-鿿]/.test(text) ? "cmn" : "eng",
    )
    const container = document.createElement("div")
    const textNode = document.createTextNode(LONG_ENGLISH)
    container.appendChild(textNode)
    document.body.appendChild(container)

    await translateNodes([textNode], "walk-id", false, createConfig({ mode }))

    expect(mocks.translateTextForPage).toHaveBeenCalledOnce()
  })
})
