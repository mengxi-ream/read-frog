import type { TTSConfig } from "@/types/config/tts"
import { createDefaultTTSLanguageVoices, EDGE_TTS_FALLBACK_VOICE } from "@/types/config/tts"

export const DEFAULT_TTS_CONFIG: TTSConfig = {
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
  defaultVoice: EDGE_TTS_FALLBACK_VOICE,
  languageVoices: createDefaultTTSLanguageVoices(),
  rate: 0,
  pitch: 0,
  volume: 0,
}
