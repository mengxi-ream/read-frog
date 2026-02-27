import { describe, expect, it } from "vitest"
import { getLanguageDirectionAndLang } from "../language-direction"

describe("getLanguageDirectionAndLang", () => {
  it("returns rtl and mapped lang for Arabic", () => {
    expect(getLanguageDirectionAndLang("arb")).toEqual({ dir: "rtl", lang: "ar" })
  })

  it("returns rtl for Hebrew", () => {
    const result = getLanguageDirectionAndLang("heb")

    expect(result.dir).toBe("rtl")
    expect(result.lang).toBe("he")
  })

  it("returns ltr and mapped lang for English", () => {
    expect(getLanguageDirectionAndLang("eng")).toEqual({ dir: "ltr", lang: "en" })
  })
})
