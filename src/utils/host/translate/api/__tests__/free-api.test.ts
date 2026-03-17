import { describe, expect, it } from "vitest"
import { googleTranslate, microsoftTranslate } from "../../api"

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

describeFreeApi("microsoftTranslate", () => {
  it("microsoft translates text to simplified chinese", async () => {
    const result = await microsoftTranslate("Library", "en", "zh")
    expect(result).toBe("图书馆")
  })
  it("microsoft translates text to traditional chinese", async () => {
    const result = await microsoftTranslate("Library", "en", "zh-TW")
    expect(result).toBe("圖書館")
  })
})

// describe('deeplxTranslate', () => {
//   it('should translate text', async () => {
//     const result = await deeplxTranslate('Library', 'en', 'zh', DEFAULT_PROVIDER_CONFIG.deeplx)
//     expect(result).toBe('图书馆')
//   })
//   it('should translate text to traditional chinese', async () => {
//     const result = await deeplxTranslate('Library', 'en', 'zh-TW', DEFAULT_PROVIDER_CONFIG.deeplx)
//     expect(result).toBe('圖書館')
//   })
// })
