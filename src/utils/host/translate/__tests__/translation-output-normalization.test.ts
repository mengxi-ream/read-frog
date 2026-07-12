import { describe, expect, it } from "vitest"
import { normalizeTranslationOutput } from "../translation-output-normalization"

describe("normalizeTranslationOutput", () => {
  const googleProvider = { provider: "google-translate" as const }
  const microsoftProvider = { provider: "microsoft-translate" as const }

  it("decodes apostrophe and quote entities returned by Google translateHtml", () => {
    expect(normalizeTranslationOutput(googleProvider, "L&#39;Iran")).toBe("L'Iran")
    expect(normalizeTranslationOutput(googleProvider, "&quot;Dichiarazione&quot;")).toBe(
      '"Dichiarazione"',
    )
  })

  it("decodes safe text entities for Google Translate", () => {
    expect(normalizeTranslationOutput(googleProvider, "AT&amp;T&nbsp;")).toBe("AT&T\u00A0")
  })

  it("decodes escaped tags for Google Translate", () => {
    expect(normalizeTranslationOutput(googleProvider, "&lt;span&gt;")).toBe("<span>")
    expect(normalizeTranslationOutput(googleProvider, "&#60;span&#62;")).toBe("<span>")
  })

  it("keeps real HTML tags while decoding text entities inside them", () => {
    expect(normalizeTranslationOutput(googleProvider, "<span>L&#39;Iran</span>")).toBe(
      "<span>L'Iran</span>",
    )
  })

  it("does not normalize non-Google providers", () => {
    expect(normalizeTranslationOutput(microsoftProvider, "A&amp;B")).toBe("A&amp;B")
  })

  it("decodes apostrophes in input-translation results (issue #1517)", () => {
    expect(normalizeTranslationOutput(googleProvider, "It&#39;s")).toBe("It's")
  })

  it("does not decode semicolon-less legacy entities such as URL query params", () => {
    expect(normalizeTranslationOutput(googleProvider, "?page=1&copy=true")).toBe(
      "?page=1&copy=true",
    )
  })

  it("decodes escaped entity mentions exactly once", () => {
    expect(normalizeTranslationOutput(googleProvider, "&amp;amp;")).toBe("&amp;")
  })
})
