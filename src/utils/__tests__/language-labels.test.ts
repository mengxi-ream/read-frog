import { beforeEach, describe, expect, it, vi } from "vitest"
import { getGlossaryTargetLangLabel, getLanguageLabel } from "../language-labels"

const ui = vi.hoisted(() => ({ locale: "en" }))

// The shared i18n mock always answers in English. This file switches the
// interface language to see the names follow it.
vi.mock("@/utils/i18n", () => ({
  i18n: { t: (key: string) => key },
  getUiLocale: () => ui.locale,
}))

describe("getLanguageLabel", () => {
  beforeEach(() => {
    ui.locale = "en"
  })

  it("combines the language's name in the interface language with its own name", () => {
    expect(getLanguageLabel("ja")).toBe("Japanese (日本語)")
    expect(getLanguageLabel("pt-PT")).toBe("European Portuguese (Português europeu)")
    expect(getLanguageLabel("zh-Hant")).toBe("Traditional Chinese (繁體中文)")
  })

  it("names the language in the interface language the user reads", () => {
    ui.locale = "zh-TW"
    expect(getLanguageLabel("pt-PT")).toBe("歐洲葡萄牙語 (Português europeu)")

    ui.locale = "zh-CN"
    expect(getLanguageLabel("pt-PT")).toBe("欧洲葡萄牙语 (Português europeu)")
  })

  it("names languages browsers have no name for", () => {
    // Chrome has no name for Wallisian in any locale. The names are kept in
    // @read-frog/definitions, not taken from Intl.DisplayNames.
    expect(getLanguageLabel("wls")).toBe("Wallisian (Fakaʻuvea)")
  })
})

describe("getGlossaryTargetLangLabel", () => {
  it("names a listed language, and every language for the all-languages value", () => {
    expect(getGlossaryTargetLangLabel("ja")).toBe("Japanese")
    expect(getGlossaryTargetLangLabel("all")).toBe("options.advanced.glossary.allLanguages")
  })

  it("shows a language no build lists as it is stored", () => {
    // From an imported file or a newer build; it must not blank the glossary page.
    expect(getGlossaryTargetLangLabel("tok" as never)).toBe("tok")
  })
})
