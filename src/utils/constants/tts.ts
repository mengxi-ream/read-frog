import type { TTSConfig } from "@/types/config/tts"
import type { MiniMaxTTSConfig } from "@/types/minimax-tts"
import { createDefaultTTSLanguageVoices, EDGE_TTS_FALLBACK_VOICE } from "@/types/config/tts"

export const DEFAULT_MINIMAX_TTS_CONFIG: MiniMaxTTSConfig = {
  region: "global",
  model: "speech-2.8-hd",
  voiceId: "",
  audioFormat: "mp3",
}

export const DEFAULT_TTS_CONFIG: TTSConfig = {
  defaultVoice: EDGE_TTS_FALLBACK_VOICE,
  languageVoices: createDefaultTTSLanguageVoices(),
  rate: 0,
  pitch: 0,
  volume: 0,
  backend: "edge",
  minimax: DEFAULT_MINIMAX_TTS_CONFIG,
}
