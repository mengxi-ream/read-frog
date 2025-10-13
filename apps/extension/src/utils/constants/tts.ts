// This is a list of voices available for the OpenAI API

import type { TTSConfig, TTSVoice } from '@/types/config/tts'

// https://www.openai.fm/
export const TTS_VOICES_ITEMS: Record<TTSVoice, { name: string }> = {
  alloy: { name: 'Alloy' },
  ash: { name: 'Ash' },
  ballad: { name: 'Ballad' },
  coral: { name: 'Coral' },
  echo: { name: 'Echo' },
  fable: { name: 'Fable' },
  nova: { name: 'Nova' },
  onyx: { name: 'Onyx' },
  sage: { name: 'Sage' },
  shimmer: { name: 'Shimmer' },
  verse: { name: 'Verse' },
}

export const DEFAULT_TTS_CONFIG: TTSConfig = {
  providerId: 'openai-default',
  model: 'gpt-4o-mini-tts',
  voice: 'ash',
  speed: 1,
}
