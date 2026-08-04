import type { TTSConfig } from "@/types/config/tts"
import { describe, expect, it } from "vitest"
import { selectTTSVoice } from "../use-text-to-speech"

const baseTtsConfig = {
  backend: "edge",
  openAICompatible: {
    baseURL: "http://127.0.0.1:8880/v1",
    apiKey: "",
    model: "kokoro",
    voice: "af_heart",
    responseFormat: "mp3",
    speed: 1,
    instructions: "",
  },
  defaultVoice: "en-US-DavisNeural",
  languageVoices: {
    eng: "en-US-DavisNeural",
    jpn: "ja-JP-KeitaNeural",
  },
  rate: 0,
  pitch: 0,
  volume: 0,
} as TTSConfig

describe("selectTTSVoice", () => {
  it("prefers a forced preview voice over language detection", () => {
    expect(selectTTSVoice(baseTtsConfig, "eng", "ja-JP-KeitaNeural")).toBe("ja-JP-KeitaNeural")
  })

  it("uses the detected language voice when present", () => {
    expect(selectTTSVoice(baseTtsConfig, "jpn")).toBe("ja-JP-KeitaNeural")
  })

  it("falls back to the default voice when there is no language match", () => {
    expect(selectTTSVoice(baseTtsConfig, "fra")).toBe("en-US-DavisNeural")
    expect(selectTTSVoice(baseTtsConfig, null)).toBe("en-US-DavisNeural")
  })
})
