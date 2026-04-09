import { describe, expect, it } from "vitest"
import {
  createDefaultTTSLanguageVoices,
  EDGE_TTS_FALLBACK_VOICE,
  getDefaultTTSVoiceForLanguage,
} from "../tts"

describe("tts config defaults", () => {
  it("uses Davis as the fallback/default US English voice", () => {
    expect(EDGE_TTS_FALLBACK_VOICE).toBe("en-US-DavisNeural")
    expect(getDefaultTTSVoiceForLanguage("eng")).toBe("en-US-DavisNeural")
  })

  it("seeds English language voices with the Davis default", () => {
    expect(createDefaultTTSLanguageVoices().eng).toBe("en-US-DavisNeural")
  })
})
