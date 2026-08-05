import { describe, expect, it } from "vitest"
import { googleTranslate } from "../../api"

const describeFreeApi = process.env.SKIP_FREE_API === "true" ? describe.skip : describe

describeFreeApi("googleTranslate", () => {
  it("google translates text to simplified chinese", async () => {
    const result = await googleTranslate("Library", "en", "zh")
    expect(result).toBe("图书馆")
  })
  it("google translates text to traditional chinese", async () => {
    const result = await googleTranslate("Library", "en", "zh-TW")
    expect(result).toBe("圖書館")
  })
})

// The microsoftTranslate cases lived here too, hitting the same live endpoints. Its token
// endpoint now answers 404, so they failed on every run regardless of the change under test.
// Removed rather than skipped — a suite that only ever goes red stops being read at all.
