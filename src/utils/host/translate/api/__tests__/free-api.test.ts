import type { LanguageTag } from "@read-frog/definitions"
import { describe, expect, it } from "vitest"
import { googleTranslate, microsoftTranslate } from "../../api"
import { toGoogleLanguageCode, toMicrosoftLanguageCode } from "../language-codes"

const describeFreeApi = process.env.SKIP_FREE_API === "true" ? describe.skip : describe

// Each language is sent as the extension sends it, through language-codes.ts.
function google(text: string, tag: LanguageTag) {
  return googleTranslate(text, "en", toGoogleLanguageCode(tag))
}

function microsoft(text: string, tag: LanguageTag) {
  return microsoftTranslate(text, "en", toMicrosoftLanguageCode(tag))
}

// Brazilian Portuguese takes "o ônibus" and "o trem" here.
const COMMUTE = "Every morning I take the bus and then the train to the office."
// Mandarin reads the second sentence as "我还没吃晚饭".
const DINNER = "What are you doing tonight? I have not eaten dinner yet."

describeFreeApi("googleTranslate", () => {
  it("google translates text to simplified chinese", async () => {
    expect(await google("Library", "zh-Hans")).toBe("图书馆")
  })
  it("google translates text to traditional chinese", async () => {
    expect(await google("Library", "zh-Hant")).toBe("圖書館")
  })
  it("google translates text to european portuguese", async () => {
    const result = await google(COMMUTE, "pt-PT")
    expect(result).toContain("autocarro")
    expect(result).toContain("comboio")
  })
  it("google translates text to cantonese", async () => {
    expect(await google(DINNER, "yue")).toContain("仲未食")
  })
  it("google translates text to central kurdish in arabic script", async () => {
    expect(await google("Library", "ckb")).toBe("کتێبخانە")
  })
})

describeFreeApi("microsoftTranslate", () => {
  it("microsoft translates text to simplified chinese", async () => {
    expect(await microsoft("Library", "zh-Hans")).toBe("图书馆")
  })
  it("microsoft translates text to traditional chinese", async () => {
    expect(await microsoft("Library", "zh-Hant")).toBe("圖書館")
  })
  it("microsoft translates text to european portuguese", async () => {
    const result = await microsoft(COMMUTE, "pt-PT")
    expect(result).toContain("autocarro")
    expect(result).toContain("comboio")
  })
  it("microsoft translates text to cantonese", async () => {
    expect(await microsoft(DINNER, "yue")).toContain("仲未食")
  })
  it("microsoft translates text to central kurdish in arabic script", async () => {
    // Sent as Microsoft's `ku`, its Sorani; Kurmanji would come back in Latin.
    expect(await microsoft("Library", "ckb")).toBe("کتێبخانە")
  })
})
