// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getTranslationOnlyAnchorState } from "../../core/translation-state"
import { getDeclaredTranslationLanguage } from "../declared-language"
import { ensureTranslationOnlyAnchorState } from "../translation-text-swap"

beforeEach(() => {
  document.body.replaceChildren()
  document.documentElement.removeAttribute("lang")
  document.body.removeAttribute("lang")
})

describe("getDeclaredTranslationLanguage", () => {
  it.each([
    ["zh-CN", "cmn"],
    ["zh-TW", "cmn-Hant"],
    ["en-US", "eng"],
    ["ja", "jpn"],
    ["de-DE", "deu"],
  ] as const)("resolves a local %s declaration", (locale, code) => {
    const paragraph = document.createElement("p")
    paragraph.lang = locale
    paragraph.textContent = "A paragraph with links, names and numbers."
    document.body.append(paragraph)

    expect(getDeclaredTranslationLanguage([paragraph])).toBe(code)
    expect(getDeclaredTranslationLanguage([paragraph.firstChild as Text])).toBe(code)
  })

  it("inherits a post language across inline links and mentions", () => {
    const post = document.createElement("div")
    post.lang = "zh"
    post.innerHTML =
      '<span>新用户订阅入口：</span><a href="https://x.ai/pricing">x.ai/pricing</a><span>，这是 </span><a href="/grok">@grok</a><span> 官号回复里给的入口。</span>'
    document.body.append(post)

    expect(getDeclaredTranslationLanguage(Array.from(post.children) as HTMLElement[])).toBe("cmn")
  })

  it.each(["html", "body", "main", "role-main"])(
    "ignores the document/UI language on %s",
    (root) => {
      const paragraph = document.createElement("p")
      paragraph.textContent = "An English post in a Chinese user interface."
      const container =
        root === "html"
          ? document.documentElement
          : root === "body"
            ? document.body
            : document.createElement(root === "main" ? "main" : "div")
      container.lang = "zh"
      if (root === "role-main") container.setAttribute("role", "main")
      if (root === "html") document.body.append(paragraph)
      else container.append(paragraph)
      if (!container.isConnected) document.body.append(container)

      expect(getDeclaredTranslationLanguage([paragraph])).toBeNull()
    },
  )

  it.each(["en", "zh-TW", "", "und", "invalid-language"])(
    "keeps a conflicting or unknown nested %s declaration mixed",
    (locale) => {
      const paragraph = document.createElement("p")
      paragraph.lang = "zh"
      const foreign = document.createElement("span")
      foreign.lang = locale
      foreign.textContent = "Buy now"
      paragraph.append("这是一个中文段落，其中引用了一段外语：", foreign)
      document.body.append(paragraph)

      expect(getDeclaredTranslationLanguage([paragraph])).toBe("mixed")
    },
  )

  it("honors a local override rather than its ancestor declaration", () => {
    const post = document.createElement("div")
    post.lang = "zh"
    post.innerHTML = '<p lang="en">This paragraph is English.</p>'
    document.body.append(post)
    const paragraph = post.firstElementChild as HTMLElement

    expect(getDeclaredTranslationLanguage([paragraph])).toBe("eng")
    expect(getDeclaredTranslationLanguage([post])).toBe("mixed")
  })

  it("keeps separately declared languages in one run mixed", () => {
    const chinese = document.createElement("span")
    chinese.lang = "zh"
    const english = document.createElement("span")
    english.lang = "en"
    expect(getDeclaredTranslationLanguage([chinese, english])).toBe("mixed")
  })

  it("does not guess when only part of a run has a declaration", () => {
    const declared = document.createElement("span")
    declared.lang = "zh"
    const unknown = document.createElement("span")
    expect(getDeclaredTranslationLanguage([unknown, declared])).toBe("mixed")
    expect(getDeclaredTranslationLanguage([declared, unknown])).toBe("mixed")
  })

  it("preserves a nested language even when the containing run has none", () => {
    const paragraph = document.createElement("p")
    paragraph.innerHTML = '中文正文中引用外语：<span lang="en">This needs translation.</span>'
    document.body.append(paragraph)

    expect(getDeclaredTranslationLanguage([paragraph])).toBe("mixed")
  })

  it.each([null, "en"])("reads the original %s language of an active in-place anchor", (lang) => {
    const paragraph = document.createElement("p")
    if (lang !== null) paragraph.lang = lang
    paragraph.textContent = "Original English content."
    document.body.append(paragraph)
    ensureTranslationOnlyAnchorState(paragraph, DEFAULT_CONFIG, getTranslationOnlyAnchorState)

    expect(paragraph.lang).toBe("zh")
    expect(getDeclaredTranslationLanguage([paragraph])).toBe(lang === null ? null : "eng")
  })

  it("inherits the source language through an extension-written target language", () => {
    const post = document.createElement("article")
    post.lang = "ja"
    const paragraph = document.createElement("p")
    paragraph.textContent = "Original Japanese content."
    post.append(paragraph)
    document.body.append(post)
    ensureTranslationOnlyAnchorState(paragraph, DEFAULT_CONFIG, getTranslationOnlyAnchorState)

    expect(getDeclaredTranslationLanguage([paragraph.firstChild as Text])).toBe("jpn")
  })
})
