import { createDefaultTTSLanguageVoices, EDGE_TTS_FALLBACK_VOICE } from "@/types/config/tts";
export const DEFAULT_TTS_CONFIG = {
    defaultVoice: EDGE_TTS_FALLBACK_VOICE,
    languageVoices: createDefaultTTSLanguageVoices(),
    rate: 0,
    pitch: 0,
    volume: 0,
};
