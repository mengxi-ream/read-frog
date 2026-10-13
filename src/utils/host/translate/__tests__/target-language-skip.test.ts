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
  mode?: Config["pageTranslation"]["mode"]
  enableSkip?: boolean
  targetCode?: Config["language"]["targetCode"]
} = {}): Config {
  const config = structuredClone(DEFAULT_CONFIG)
  config.pageTranslation.mode = mode
  config.pageTranslation.page.enableTargetLanguageSkip = enableSkip
  config.pageTranslation.page.minCharactersPerNode = 0
  config.pageTranslation.page.minWordsPerNode = 0
  config.language.targetCode = targetCode
  config.language.sourceCode = "eng"
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

const SHORT_CHINESE_POSTS = [
  "其实 REA 这种事情在物理世界曾经发生过一次。",
  "设计CC讨论串这个功能的人",
  "一定是一个非常非常有逻辑，结构严谨，且明白大模型能力边界的人",
  "最低每月仅仅需要 8 美金！最高 200 美金可拉满 50X 用量！",
  "并且首月只需要五折！！！赶紧冲订阅吧！",
]

describe("short Chinese posts with real local language detection", () => {
  beforeEach(async () => {
    const actual = await vi.importActual<typeof import("@/utils/content/language")>(
      "@/utils/content/language",
    )
    mocks.detectLanguage.mockImplementation(actual.detectLanguage)
  })

  it.each(SHORT_CHINESE_POSTS)("skips an already-Chinese post: %s", async (text) => {
    expect(text.length).toBeLessThan(50)
    await expect(shouldSkipAsTargetLanguage(text, createConfig())).resolves.toBe(true)
    expect(mocks.detectLanguage).toHaveBeenCalledWith(text, { enableLLM: false })
  })

  it.each(SHORT_CHINESE_POSTS)("honors the disabled skip option: %s", async (text) => {
    await expect(
      shouldSkipAsTargetLanguage(text, createConfig({ enableSkip: false })),
    ).resolves.toBe(false)
    expect(mocks.detectLanguage).not.toHaveBeenCalled()
  })

  it.each([
    "This release fixes the 中文 input bug.",
    "这是一个足够长的中文句子，用来说明最新促销活动。 Buy now!",
    "这是一个足够长的中文句子，用来说明最新促销活动。 Buy, now!",
    "これは日本語の文章で翻訳する必要があります。",
    "日本語の説明：这是一个用于测试的中文句子。",
    "한국어 설명：这是一个用于测试的中文句子。",
    "Русский：这是一个用于测试的中文句子。",
    "这是中文句子 API SDK HTTP JSON",
    "你好",
    "中文！！！1234567890😀😀😀😀😀😀😀😀😀😀",
  ])("keeps ambiguous or foreign short text eligible: %s", async (text) => {
    expect(text.length).toBeLessThan(50)
    await expect(shouldSkipAsTargetLanguage(text, createConfig())).resolves.toBe(false)
    expect(mocks.detectLanguage).not.toHaveBeenCalled()
  })

  it("does not use Chinese script evidence for another target or a traditional Chinese conversion", async () => {
    for (const targetCode of ["eng", "jpn", "cmn-Hant"] as const) {
      await expect(
        shouldSkipAsTargetLanguage(SHORT_CHINESE_POSTS[0]!, createConfig({ targetCode })),
      ).resolves.toBe(false)
    }
    expect(mocks.detectLanguage).not.toHaveBeenCalled()
  })

  it("prepares invisible characters and whitespace before short-text detection", async () => {
    const text = SHORT_CHINESE_POSTS[0]!
    await expect(
      shouldSkipAsTargetLanguage(`  \u200B${text}\uFEFF  `, createConfig()),
    ).resolves.toBe(true)
    expect(mocks.detectLanguage).toHaveBeenCalledWith(text, { enableLLM: false })
  })

  describe.each(["bilingual", "translationOnly"] as const)("%s translation", (mode) => {
    it.each(SHORT_CHINESE_POSTS)(
      "makes no translation request or DOM insertion: %s",
      async (text) => {
        const container = document.createElement("div")
        const textNode = document.createTextNode(text)
        container.appendChild(textNode)
        document.body.appendChild(container)
        const insertions: MutationRecord[] = []
        const observer = new MutationObserver((records) => insertions.push(...records))
        observer.observe(container, { childList: true, subtree: true })

        await translateNodes([textNode], "walk-id", false, createConfig({ mode }))
        flushBatchedOperations()
        insertions.push(...observer.takeRecords())
        observer.disconnect()

        expect(mocks.translateTextForPage).not.toHaveBeenCalled()
        expect(container.childNodes).toHaveLength(1)
        expect(container.firstChild).toBe(textNode)
        expect(textNode.textContent).toBe(text)
        expect(insertions).toHaveLength(0)
      },
    )

    it("still requests a translation for a short English paragraph", async () => {
      const container = document.createElement("div")
      const textNode = document.createTextNode("This feature needs a translation.")
      container.appendChild(textNode)
      document.body.appendChild(container)

      await translateNodes([textNode], "walk-id", false, createConfig({ mode }))

      expect(mocks.translateTextForPage).toHaveBeenCalledOnce()
    })
  })
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
