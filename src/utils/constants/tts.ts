import type { TTSConfig } from "@/types/config/tts"
import { createDefaultTTSLanguageVoices, EDGE_TTS_FALLBACK_VOICE } from "@/types/config/tts"

export const DEFAULT_TTS_CONFIG: TTSConfig = {
  defaultVoice: EDGE_TTS_FALLBACK_VOICE,
  languageVoices: createDefaultTTSLanguageVoices(),
  detectLanguageMode: "basic",
  rate: 0,
  pitch: 0,
  volume: 0,
}
