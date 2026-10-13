// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { flushBatchedOperations } from "@/utils/host/dom/batch-dom"
import { translateNodes } from "../core/translation-modes"
import { shouldSkipPageTranslationText } from "../core/translation-request"
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

const CHINESE_POSTS = [
  "其实 REA 这种事情在物理世界曾经发生过一次。",
  "设计CC讨论串这个功能的人",
  "一定是一个非常非常有逻辑，结构严谨，且明白大模型能力边界的人",
  "最低每月仅仅需要 8 美金！最高 200 美金可拉满 50X 用量！",
  "并且首月只需要五折！！！赶紧冲订阅吧！",
  "新用户订阅入口：x.ai/pricing ，这是 @grok 官号回复里给的入口。",
  "已经在用 SuperGrok、Cursor 或 X Premium 的话，从下面这两个入口切换，旧套餐会按比例退款：\n- [accounts.x.ai/unify](accounts.x.ai/unify)\n- [cursor.com/unify](cursor.com/unify)",
]

function declaredParagraph(text: string, lang = "zh") {
  const paragraph = document.createElement("div")
  paragraph.lang = lang
  const node = document.createTextNode(text)
  paragraph.append(node)
  document.body.append(paragraph)
  return { paragraph, node }
}

describe("paragraph language declarations with real local text fallback", () => {
  beforeEach(async () => {
    const actual = await vi.importActual<typeof import("@/utils/content/language")>(
      "@/utils/content/language",
    )
    mocks.detectLanguage.mockImplementation(actual.detectLanguage)
  })

  it.each(CHINESE_POSTS)("honors the actual X post language: %s", async (text) => {
    const { node } = declaredParagraph(text)
    await expect(shouldSkipPageTranslationText(text, createConfig(), [node])).resolves.toBe(true)
    expect(mocks.detectLanguage).not.toHaveBeenCalled()
  })

  it.each(CHINESE_POSTS.slice(0, 5))("honors the disabled skip option: %s", async (text) => {
    const { node } = declaredParagraph(text)
    await expect(
      shouldSkipPageTranslationText(text, createConfig({ enableSkip: false }), [node]),
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

  it("keeps another target or traditional Chinese conversion eligible", async () => {
    const text = CHINESE_POSTS[0]!
    const { node } = declaredParagraph(text)
    for (const targetCode of ["eng", "jpn", "cmn-Hant"] as const) {
      await expect(
        shouldSkipPageTranslationText(text, createConfig({ targetCode }), [node]),
      ).resolves.toBe(false)
    }
    expect(mocks.detectLanguage).not.toHaveBeenCalled()
  })

  it("handles invisible characters in an annotated paragraph without guessing its language", async () => {
    const text = `  \u200B${CHINESE_POSTS[0]!}\uFEFF  `
    const { node } = declaredParagraph(text)
    await expect(shouldSkipPageTranslationText(text, createConfig(), [node])).resolves.toBe(true)
    expect(mocks.detectLanguage).not.toHaveBeenCalled()
  })

  describe.each(["bilingual", "translationOnly"] as const)("%s translation", (mode) => {
    it("skips a real-shaped X post with inline links and multiple paragraphs", async () => {
      const post = document.createElement("div")
      post.lang = "zh"
      post.style.whiteSpace = "pre-wrap"
      post.innerHTML =
        '<span>最低每月仅仅需要 8 美金！最高 200 美金可拉满 50X 用量！\n\n并且首月只需要五折！！！赶紧冲订阅吧！\n\n新用户订阅入口：</span><a href="https://x.ai/pricing">x.ai/pricing</a><span>\n，这是 </span><span><a href="/grok">@grok</a></span><span> 官号回复里给的入口。\n\n已经在用 SuperGrok、Cursor 或 X Premium 的话，从下面这两个入口切换，旧套餐会按比例退款：\n- [</span><a href="https://accounts.x.ai/unify">accounts.x.ai/unify</a><span>](</span><a href="https://accounts.x.ai/unify">accounts.x.ai/unify</a><span>)</span>'
      document.body.append(post)
      const beforeHtml = post.innerHTML

      await translateNodes([post], "walk-id", false, createConfig({ mode }))
      flushBatchedOperations()

      expect(mocks.translateTextForPage).not.toHaveBeenCalled()
      expect(mocks.detectLanguage).not.toHaveBeenCalled()
      expect(post.innerHTML).toBe(beforeHtml)
      expect(post.querySelectorAll(".read-frog-translated-content-wrapper")).toHaveLength(0)
    })

    it("keeps an explicitly foreign inline passage eligible even if franc guesses Chinese", async () => {
      mocks.detectLanguage.mockResolvedValue("cmn")
      const paragraph = document.createElement("div")
      paragraph.lang = "zh"
      paragraph.innerHTML = `${LONG_CHINESE}<span lang="en">This sentence needs translation.</span>`
      document.body.append(paragraph)

      await translateNodes([paragraph], "walk-id", false, createConfig({ mode }))

      expect(mocks.translateTextForPage).toHaveBeenCalledOnce()
      expect(mocks.detectLanguage).not.toHaveBeenCalled()
    })

    it.each(CHINESE_POSTS)("makes no translation request or DOM insertion: %s", async (text) => {
      const container = document.createElement("div")
      container.lang = "zh"
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
    })

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
