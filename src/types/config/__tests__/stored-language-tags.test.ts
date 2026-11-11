import { describe, expect, it } from "vitest"
import { testSeries } from "@/utils/config/__tests__/example/v121"
import { migrate } from "@/utils/config/migration-scripts/v121-to-v122"
import { configSchema } from "../config"

// A UI context can read storage before the background's v121 → v122 migration
// runs. A config that fails to parse there reads as DEFAULT_CONFIG, and the
// next setting the user changes saves that over the whole config.
describe("configSchema on a config from before language tags", () => {
  it.each(Object.entries(testSeries))("reads %s as the migration writes it", (_, { config }) => {
    const parsed = configSchema.safeParse(config)

    expect(parsed.error).toBeUndefined()
    expect(parsed.data).toEqual(configSchema.parse(migrate(config)))
  })

  it("reads every field that holds a language", () => {
    const config = structuredClone(testSeries["complex-config-from-v020"]!.config)
    config.translationHub = { ...config.translationHub, sourceCode: "spa", targetCode: "por" }
    config.inputTranslation = { ...config.inputTranslation, fromLang: "jpn", toLang: "cmn-Hant" }
    config.pageTranslation.page = {
      ...config.pageTranslation.page,
      autoTranslateLanguages: ["por", "cmn"],
      skipLanguages: ["yue", "zsm"],
    }

    const parsed = configSchema.parse(config)

    expect(parsed).toEqual(configSchema.parse(migrate(config)))
    expect(parsed.translationHub).toMatchObject({ sourceCode: "es", targetCode: "pt-BR" })
    expect(parsed.inputTranslation).toMatchObject({ fromLang: "ja", toLang: "zh-Hant" })
    expect(parsed.pageTranslation.page.autoTranslateLanguages).toEqual(["pt-BR", "zh-Hans"])
    expect(parsed.pageTranslation.page.skipLanguages).toEqual(["yue", "ms"])
    expect(parsed.tts.languageVoices["pt-PT"]).toBe("pt-PT-DuarteNeural")
  })

  it("still rejects a language that is neither a tag nor a known code", () => {
    const config = structuredClone(testSeries["complex-config-from-v020"]!.config)
    config.language = { ...config.language, targetCode: "xx-Unknown" }

    expect(configSchema.safeParse(config).success).toBe(false)
  })
})
