import { z } from 'zod'

export const TTS_MODELS = [
  'gpt-4o-mini-tts',
  'tts-1',
  'tts-1-hd',
] as const
export const ttsModelSchema = z.enum(TTS_MODELS)

export const TTS_1_VOICES = [
  'alloy',
  'ash',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
] as const

export const GPT_4O_MINI_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
] as const

// Map models to their available voices
export const MODEL_VOICES_MAP = {
  'tts-1': TTS_1_VOICES,
  'tts-1-hd': TTS_1_VOICES,
  'gpt-4o-mini-tts': GPT_4O_MINI_VOICES,
} as const

// Union of all possible voices
export const ALL_TTS_VOICES = [...new Set([...TTS_1_VOICES, ...GPT_4O_MINI_VOICES])] as const
export const ttsVoiceSchema = z.enum(ALL_TTS_VOICES as [string, ...string[]])

export const MIN_TTS_SPEED = 0.25
export const MAX_TTS_SPEED = 4
export const ttsSpeedSchema = z.coerce.number().min(MIN_TTS_SPEED).max(MAX_TTS_SPEED)

export const ttsConfigSchema = z.object({
  providerId: z.string().nullable(),
  model: ttsModelSchema,
  voice: ttsVoiceSchema,
  speed: ttsSpeedSchema,
}).refine(
  data => isVoiceAvailableForModel(data.voice, data.model),
  {
    error: data => `Voice "${data.voice}" is not available for model "${data.model}"`,
    path: ['voice'],
  },
)

export type TTSVoice = z.infer<typeof ttsVoiceSchema>
export type TTSModel = z.infer<typeof ttsModelSchema>
export type TTSConfig = z.infer<typeof ttsConfigSchema>

// Helper function to get available voices for a model
export function getVoicesForModel(model: TTSModel) {
  return MODEL_VOICES_MAP[model]
}

// Helper function to check if a voice is available for a model
export function isVoiceAvailableForModel(voice: string, model: TTSModel): boolean {
  return MODEL_VOICES_MAP[model].includes(voice as any)
}
