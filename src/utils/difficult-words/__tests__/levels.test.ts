import { afterEach, describe, expect, it, vi } from "vitest"
import { getVocabLanguageName } from "../levels"

const locale = vi.hoisted(() => ({ current: "en" }))

vi.mock("@/utils/i18n", () => ({
  getUiLocale: () => locale.current,
  i18n: { t: (key: string) => key },
}))

afterEach(() => {
  locale.current = "en"
})

describe("getVocabLanguageName", () => {
  it("names Portuguese for both its varieties, and the other languages as everywhere else", () => {
    expect(getVocabLanguageName("pt-BR")).toBe("Portuguese")
    expect(getVocabLanguageName("de")).toBe("German")
    expect(getVocabLanguageName("zh-Hant")).toBe("Traditional Chinese")

    locale.current = "zh-CN"
    expect(getVocabLanguageName("pt-BR")).toBe("葡萄牙语")
    expect(getVocabLanguageName("zh-Hans")).toBe("简体中文")
  })
})
