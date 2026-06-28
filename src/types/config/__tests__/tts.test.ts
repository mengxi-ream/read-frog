import { describe, expect, it } from "vitest"
import {
  createDefaultTTSLanguageVoices,
  EDGE_TTS_FALLBACK_VOICE,
  EDGE_TTS_VOICE_GROUPS,
  EDGE_TTS_VOICE_ITEMS,
  EDGE_TTS_VOICES,
  getDefaultTTSVoiceForLanguage,
  getEdgeTTSVoiceItem,
  isKnownEdgeTTSVoice,
} from "../tts"

describe("tts config defaults", () => {
  it("uses Andrew Multilingual as the fallback/default US English voice", () => {
    expect(EDGE_TTS_FALLBACK_VOICE).toBe("en-US-AndrewMultilingualNeural")
    expect(getDefaultTTSVoiceForLanguage("eng")).toBe("en-US-AndrewMultilingualNeural")
  })

  it("uses ISO 639-3 defaults without collapsing Chinese language variants", () => {
    expect(getDefaultTTSVoiceForLanguage("cmn")).toBe("zh-CN-XiaoxiaoMultilingualNeural")
    expect(getDefaultTTSVoiceForLanguage("cmn-Hant")).toBe("zh-TW-YunJheNeural")
    expect(getDefaultTTSVoiceForLanguage("yue")).toBe("yue-CN-XiaoMinNeural")
  })

  it("seeds language voices with multilingual defaults when available", () => {
    const languageVoices = createDefaultTTSLanguageVoices()

    expect(languageVoices.eng).toBe("en-US-AndrewMultilingualNeural")
    expect(languageVoices.cmn).toBe("zh-CN-XiaoxiaoMultilingualNeural")
    expect(languageVoices.yue).toBe("yue-CN-XiaoMinNeural")
    expect(languageVoices.deu).toBe("de-DE-FlorianMultilingualNeural")
    expect(languageVoices.spa).toBe("es-ES-TristanMultilingualNeural")
    expect(languageVoices.fra).toBe("fr-FR-RemyMultilingualNeural")
    expect(languageVoices.ita).toBe("it-IT-AlessioMultilingualNeural")
    expect(languageVoices.jpn).toBe("ja-JP-MasaruMultilingualNeural")
    expect(languageVoices.kor).toBe("ko-KR-HyunsuMultilingualNeural")
    expect(languageVoices.por).toBe("pt-BR-MacerioMultilingualNeural")
    expect(languageVoices.bre).toBe("fr-FR-RemyMultilingualNeural")
    expect(languageVoices.grn).toBe("es-ES-TristanMultilingualNeural")
    expect(languageVoices.lat).toBe("it-IT-AlessioMultilingualNeural")
    expect(languageVoices.bod).toBe("zh-CN-XiaoxiaoMultilingualNeural")
  })

  it("only uses known Edge TTS voices in the default language voice map", () => {
    const languageVoices = createDefaultTTSLanguageVoices()
    const unknownDefaultVoices = Object.values(languageVoices).filter(voice => !isKnownEdgeTTSVoice(voice))

    expect(unknownDefaultVoices).toEqual([])
  })

  it("exposes a unique sorted voice list from voice metadata", () => {
    expect(EDGE_TTS_VOICE_ITEMS).toHaveLength(631)
    expect(EDGE_TTS_VOICES).toEqual(EDGE_TTS_VOICE_ITEMS.map(item => item.voice))
    expect(new Set(EDGE_TTS_VOICES).size).toBe(EDGE_TTS_VOICES.length)
    expect(EDGE_TTS_VOICES).toEqual([...EDGE_TTS_VOICES].sort((a, b) => a.localeCompare(b)))
  })

  it("groups voice metadata by Microsoft Learn language labels", () => {
    const groupedItems = EDGE_TTS_VOICE_GROUPS.flatMap(group => group.items)
    expect(groupedItems).toHaveLength(EDGE_TTS_VOICE_ITEMS.length)
    expect(groupedItems.map(item => item.voice).sort((a, b) => a.localeCompare(b))).toEqual(EDGE_TTS_VOICES)
    expect(EDGE_TTS_VOICE_GROUPS).toContainEqual(expect.objectContaining({
      language: "English (United States)",
      items: expect.arrayContaining([
        expect.objectContaining({ voice: "en-US-AvaMultilingualNeural" }),
      ]),
    }))
  })

  it("includes Azure voice metadata for standard and multilingual voices", () => {
    expect(getEdgeTTSVoiceItem("af-ZA-WillemNeural")).toMatchObject({
      language: "Afrikaans (South Africa)",
      type: "Standard",
      gender: "Male",
    })
    expect(getEdgeTTSVoiceItem("en-US-AvaMultilingualNeural")).toMatchObject({
      type: "Multilingual",
      gender: "Female",
    })
    expect(getEdgeTTSVoiceItem("zh-CN-Mei:MAI-Voice-2")).toMatchObject({
      language: "Chinese (Mandarin, Simplified)",
      type: "Standard",
      gender: "Female",
    })
  })

  it("excludes Azure OpenAI voices that are not exposed by Edge consumer TTS", () => {
    expect(isKnownEdgeTTSVoice("en-US-FableMultilingualNeural")).toBe(false)
    expect(isKnownEdgeTTSVoice("en-US-FableMultilingualNeuralHD")).toBe(false)
    expect(EDGE_TTS_VOICE_ITEMS.some(item => String(item.type) === "Multilingual (OpenAI)")).toBe(false)
  })

  it("temporarily excludes region-dependent HD and DragonHD voices from Edge TTS options", () => {
    expect(isKnownEdgeTTSVoice("en-US-Ava:DragonHDLatestNeural")).toBe(false)
    expect(isKnownEdgeTTSVoice("en-US-Andrew:DragonHDOmniLatestNeural")).toBe(false)
    expect(isKnownEdgeTTSVoice("en-US-Jimmie:DragonHDFlashLatestNeural")).toBe(false)
    expect(isKnownEdgeTTSVoice("zh-CN-Yunxi:DragonHDFlashLatestNeural")).toBe(false)
    expect(EDGE_TTS_VOICE_ITEMS.some(item => item.type.includes("HD"))).toBe(false)
    expect(EDGE_TTS_VOICE_ITEMS.some(item => item.voice.includes("DragonHD"))).toBe(false)
  })

  it("keeps known Edge-only voices that are not in the Azure Speech table", () => {
    expect(isKnownEdgeTTSVoice("ha-NG-AbubakarNeural")).toBe(true)
    expect(getEdgeTTSVoiceItem("ha-NG-AbubakarNeural")).toMatchObject({
      language: "Hausa (Nigeria)",
      type: "Standard",
      gender: "Neutral",
    })
  })
})
