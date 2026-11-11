import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v121-to-v122"

describe("v121-to-v122 migration", () => {
  it("moves every stored language from its ISO 639-3 code to its BCP 47 tag", () => {
    const oldConfig = {
      language: { sourceCode: "jpn", targetCode: "cmn-Hant", level: "intermediate" },
      translationHub: { sourceCode: "auto", targetCode: "kor", promptId: null },
      inputTranslation: { enabled: true, fromLang: "targetCode", toLang: "deu" },
      pageTranslation: {
        page: { autoTranslateLanguages: ["eng", "fra"], skipLanguages: ["cmn", "yue"] },
      },
      tts: { defaultVoice: "en-US-GuyNeural", languageVoices: { eng: "en-US-GuyNeural" } },
      selectionToolbar: {
        customActions: [
          { id: "a", sampleData: { selection: "x", targetCode: "spa", values: {} } },
          { id: "b" },
        ],
      },
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated).toEqual({
      language: { sourceCode: "ja", targetCode: "zh-Hant", level: "intermediate" },
      translationHub: { sourceCode: "auto", targetCode: "ko", promptId: null },
      inputTranslation: { enabled: true, fromLang: "targetCode", toLang: "de" },
      pageTranslation: {
        page: { autoTranslateLanguages: ["en", "fr"], skipLanguages: ["zh-Hans", "yue"] },
      },
      tts: {
        defaultVoice: "en-US-GuyNeural",
        languageVoices: { en: "en-US-GuyNeural", "pt-PT": "pt-PT-DuarteNeural" },
      },
      selectionToolbar: {
        customActions: [
          { id: "a", sampleData: { selection: "x", targetCode: "es", values: {} } },
          { id: "b" },
        ],
      },
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toEqual(migrated)
  })

  it("keeps Portuguese Brazilian and adds a European Portuguese voice", () => {
    const migrated = migrate({
      language: { sourceCode: "auto", targetCode: "por" },
      tts: { languageVoices: { por: "pt-BR-AntonioNeural" } },
    })

    expect(migrated.language.targetCode).toBe("pt-BR")
    expect(migrated.tts.languageVoices).toEqual({
      "pt-BR": "pt-BR-AntonioNeural",
      "pt-PT": "pt-PT-DuarteNeural",
    })
  })

  it("moves the codes whose tags are not their canonical form", () => {
    const migrated = migrate({
      language: { sourceCode: "zlm", targetCode: "fuv" },
      pageTranslation: { page: { skipLanguages: ["tgl", "prs", "bcl"] } },
    })

    expect(migrated.language).toEqual({ sourceCode: "ms", targetCode: "ff" })
    expect(migrated.pageTranslation.page.skipLanguages).toEqual(["fil", "fa-AF", "bik"])
  })

  it("keeps a European Portuguese voice that is already there", () => {
    const migrated = migrate({ tts: { languageVoices: { "pt-PT": "pt-PT-RaquelNeural" } } })

    expect(migrated.tts.languageVoices).toEqual({ "pt-PT": "pt-PT-RaquelNeural" })
  })

  it("leaves malformed config shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ language: null, tts: null })).toEqual({ language: null, tts: null })
    expect(migrate({ pageTranslation: { page: null } })).toEqual({
      pageTranslation: { page: null },
    })
    expect(migrate({ selectionToolbar: { customActions: "x" } })).toEqual({
      selectionToolbar: { customActions: "x" },
    })
    expect(migrate({ language: { targetCode: "not-a-code" } })).toStrictEqual({
      language: { targetCode: "not-a-code" },
    })
  })
})
