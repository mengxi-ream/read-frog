import { describe, expect, it } from "vitest"
import { normalizeTranslationOutput } from "../translation-output-normalization"

describe("normalizeTranslationOutput", () => {
  const googleProvider = { provider: "google-translate" as const }
  const microsoftProvider = { provider: "microsoft-translate" as const }

  it("decodes apostrophe and quote entities returned by Google translateHtml", () => {
    expect(normalizeTranslationOutput(googleProvider, "L&#39;Iran")).toBe("L'Iran")
    expect(normalizeTranslationOutput(googleProvider, "&quot;Dichiarazione&quot;")).toBe("\"Dichiarazione\"")
  })

  it("decodes safe text entities for Google Translate", () => {
    expect(normalizeTranslationOutput(googleProvider, "AT&amp;T&nbsp;")).toBe("AT&T\u00A0")
  })

  it("decodes escaped tags for Google Translate", () => {
    expect(normalizeTranslationOutput(googleProvider, "&lt;span&gt;")).toBe("<span>")
    expect(normalizeTranslationOutput(googleProvider, "&#60;span&#62;")).toBe("<span>")
  })

  it("keeps real HTML tags while decoding text entities inside them", () => {
    expect(normalizeTranslationOutput(googleProvider, "<span>L&#39;Iran</span>")).toBe("<span>L'Iran</span>")
  })

  it("does not normalize non-Google providers", () => {
    expect(normalizeTranslationOutput(microsoftProvider, "A&amp;B")).toBe("A&amp;B")
  })
})
