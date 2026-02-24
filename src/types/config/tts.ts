import type { LangCodeISO6391, LangCodeISO6393 } from "@read-frog/definitions"
import {
  ISO6393_TO_6391,
  LANG_CODE_ISO6393_OPTIONS,
  langCodeISO6393Schema,
} from "@read-frog/definitions"
import { z } from "zod"

export type TTSVoice = string

const EDGE_TTS_VOICE_BY_ISO6391: Partial<Record<LangCodeISO6391, TTSVoice>> = {
  "en": "en-US-GuyNeural",
  "zh": "zh-CN-YunxiNeural",
  "zh-TW": "zh-TW-YunJheNeural",
  "es": "es-ES-AlvaroNeural",
  "ru": "ru-RU-DmitryNeural",
  "ar": "ar-SA-HamedNeural",
  "bn": "bn-BD-NabanitaNeural",
  "hi": "hi-IN-MadhurNeural",
  "pt": "pt-BR-AntonioNeural",
  "id": "id-ID-ArdiNeural",
  "ja": "ja-JP-KeitaNeural",
  "fr": "fr-FR-HenriNeural",
  "de": "de-DE-ConradNeural",
  "jv": "jv-ID-DimasNeural",
  "ko": "ko-KR-InJoonNeural",
  "te": "te-IN-MohanNeural",
  "vi": "vi-VN-NamMinhNeural",
  "mr": "mr-IN-ManoharNeural",
  "it": "it-IT-DiegoNeural",
  "ta": "ta-IN-ValluvarNeural",
  "tr": "tr-TR-AhmetNeural",
  "ur": "ur-PK-AsadNeural",
  "gu": "gu-IN-NiranjanNeural",
  "pl": "pl-PL-MarekNeural",
  "uk": "uk-UA-OstapNeural",
  "kn": "kn-IN-GaganNeural",
  "ml": "ml-IN-MidhunNeural",
  "fa": "fa-IR-FaridNeural",
  "my": "my-MM-ThihaNeural",
  "sw": "sw-KE-RafikiNeural",
  "su": "su-ID-JajangNeural",
  "ro": "ro-RO-EmilNeural",
  "pa": "pa-IN-OjasNeural",
  "am": "am-ET-AmehaNeural",
  "ha": "ha-NG-AbubakarNeural",
  "ff": "ff-Latn-SN-SambaNeural",
  "bs": "bs-BA-GoranNeural",
  "hr": "hr-HR-SreckoNeural",
  "nl": "nl-NL-MaartenNeural",
  "sr": "sr-RS-NicholasNeural",
  "th": "th-TH-NiwatNeural",
  "yo": "yo-NG-AbeoNeural",
  "uz": "uz-UZ-SardorNeural",
  "ms": "ms-MY-OsmanNeural",
  "ig": "ig-NG-EzinneNeural",
  "ne": "ne-NP-SagarNeural",
  "tl": "fil-PH-AngeloNeural",
  "hu": "hu-HU-TamasNeural",
  "az": "az-AZ-BabekNeural",
  "si": "si-LK-SameeraNeural",
  "el": "el-GR-NestorasNeural",
  "cs": "cs-CZ-AntoninNeural",
  "ny": "en-US-GuyNeural",
  "rw": "rw-RW-JeanNeural",
  "zu": "zu-ZA-ThembaNeural",
  "bg": "bg-BG-BorislavNeural",
  "sv": "sv-SE-MattiasNeural",
  "ln": "ln-CD-BaudouinNeural",
  "so": "so-SO-MuuseNeural",
  "kk": "kk-KZ-DauletNeural",
  "be": "be-BY-YauheniNeural",
  "he": "he-IL-AvriNeural",
  "nb": "nb-NO-FinnNeural",
  "nn": "nn-NO-FinnNeural",
  "af": "af-ZA-AdriNeural",
  "sq": "sq-AL-IlirNeural",
  "as": "as-IN-BiswajitNeural",
  "eu": "eu-ES-AnderNeural",
  "br": "fr-FR-HenriNeural",
  "ca": "ca-ES-EnricNeural",
  "co": "fr-FR-HenriNeural",
  "cy": "cy-GB-AledNeural",
  "da": "da-DK-JeppeNeural",
  "dv": "si-LK-SameeraNeural",
  "eo": "en-US-GuyNeural",
  "et": "et-EE-KertNeural",
  "fo": "fo-FO-PoulNeural",
  "fj": "en-US-GuyNeural",
  "fi": "fi-FI-HarriNeural",
  "fy": "nl-NL-MaartenNeural",
  "gd": "en-GB-RyanNeural",
  "ga": "ga-IE-ColmNeural",
  "gl": "gl-ES-RoiNeural",
  "gn": "es-ES-AlvaroNeural",
  "ht": "fr-FR-HenriNeural",
  "hy": "hy-AM-HaykNeural",
  "io": "en-US-GuyNeural",
  "ia": "en-US-GuyNeural",
  "is": "is-IS-GunnarNeural",
  "ka": "ka-GE-GiorgiNeural",
  "km": "km-KH-PisethNeural",
  "ky": "kk-KZ-DauletNeural",
  "lo": "lo-LA-ChanthavongNeural",
  "la": "it-IT-DiegoNeural",
  "lv": "lv-LV-NilsNeural",
  "lt": "lt-LT-LeonasNeural",
  "lb": "fr-FR-HenriNeural",
  "mk": "mk-MK-AleksandarNeural",
  "mt": "mt-MT-JosephNeural",
  "mn": "mn-MN-BataaNeural",
  "mi": "en-NZ-MitchellNeural",
  "oc": "fr-FR-HenriNeural",
  "or": "or-IN-DineshNeural",
  "om": "en-US-GuyNeural",
  "sa": "hi-IN-MadhurNeural",
  "sk": "sk-SK-LukasNeural",
  "sl": "sl-SI-RokNeural",
  "sm": "en-US-GuyNeural",
  "sn": "en-US-GuyNeural",
  "sd": "sd-PK-SalmanNeural",
  "st": "en-US-GuyNeural",
  "ty": "fr-FR-HenriNeural",
  "tt": "tt-RU-AidarNeural",
  "tg": "tg-TJ-SharifNeural",
  "ti": "am-ET-AmehaNeural",
  "to": "en-US-GuyNeural",
  "tn": "en-US-GuyNeural",
  "tk": "tk-TM-AmanNeural",
  "ug": "ug-CN-KashgarNeural",
  "vo": "en-US-GuyNeural",
  "wo": "en-US-GuyNeural",
  "xh": "xh-ZA-ThembaNeural",
  "yi": "he-IL-AvriNeural",
  "ak": "en-US-GuyNeural",
  "bm": "fr-FR-HenriNeural",
  "bi": "en-US-GuyNeural",
  "bo": "zh-CN-YunxiNeural",
  "ce": "ru-RU-DmitryNeural",
  "cv": "ru-RU-DmitryNeural",
  "ee": "en-US-GuyNeural",
  "lg": "en-US-GuyNeural",
  "os": "ru-RU-DmitryNeural",
  "ss": "en-US-GuyNeural",
  "ve": "en-US-GuyNeural",
  "nd": "en-US-GuyNeural",
  "nr": "en-US-GuyNeural",
  "ch": "en-US-GuyNeural",
  "mh": "en-US-GuyNeural",
  "dz": "zh-CN-YunxiNeural",
}

const EDGE_TTS_EXTRA_VOICES: TTSVoice[] = [
  "en-US-JennyNeural",
  "en-US-AriaNeural",
  "en-US-MichelleNeural",
  "en-US-DavisNeural",
  "en-US-TonyNeural",
  "zh-CN-XiaoxiaoNeural",
  "zh-CN-XiaoyiNeural",
  "zh-CN-XiaochenNeural",
  "zh-CN-XiaohanNeural",
  "zh-CN-XiaomengNeural",
  "zh-CN-XiaomoNeural",
  "zh-CN-XiaoqiuNeural",
  "zh-CN-XiaoruiNeural",
  "zh-CN-XiaoshuangNeural",
  "zh-CN-XiaoxuanNeural",
  "zh-CN-XiaoyanNeural",
  "zh-CN-XiaoyouNeural",
  "zh-CN-XiaozhenNeural",
  "zh-CN-YunyangNeural",
  "zh-CN-YunjianNeural",
  "zh-CN-YunfengNeural",
  "zh-CN-YunhaoNeural",
  "zh-CN-YunxiaNeural",
  "zh-CN-YunyeNeural",
  "zh-CN-YunzeNeural",
  "ja-JP-NanamiNeural",
  "ko-KR-SunHiNeural",
]

export const EDGE_TTS_FALLBACK_VOICE: TTSVoice = "en-US-GuyNeural"

export function getDefaultTTSVoiceForLanguage(
  langCode: LangCodeISO6393,
  fallbackVoice: TTSVoice = EDGE_TTS_FALLBACK_VOICE,
): TTSVoice {
  const iso6391 = ISO6393_TO_6391[langCode]
  if (!iso6391) {
    return fallbackVoice
  }

  return EDGE_TTS_VOICE_BY_ISO6391[iso6391] ?? fallbackVoice
}

export function createDefaultTTSLanguageVoices(
  fallbackVoice: TTSVoice = EDGE_TTS_FALLBACK_VOICE,
): Record<LangCodeISO6393, TTSVoice> {
  const entries = LANG_CODE_ISO6393_OPTIONS.map((langCode) => {
    return [langCode, getDefaultTTSVoiceForLanguage(langCode, fallbackVoice)] as const
  })
  return Object.fromEntries(entries) as Record<LangCodeISO6393, TTSVoice>
}

const EDGE_TTS_VOICE_OPTIONS = [
  ...Object.values(EDGE_TTS_VOICE_BY_ISO6391),
  ...EDGE_TTS_EXTRA_VOICES,
].filter((voice): voice is TTSVoice => !!voice)

export const EDGE_TTS_VOICES: TTSVoice[] = Array.from(new Set(EDGE_TTS_VOICE_OPTIONS))
  .sort((a, b) => a.localeCompare(b))

export function isKnownEdgeTTSVoice(voice: string): boolean {
  return EDGE_TTS_VOICES.includes(voice)
}

export const ttsVoiceSchema = z.string().trim().min(1)
export const TTS_LANGUAGE_DETECTION_MODES = ["basic", "llm"] as const
export const ttsLanguageDetectionModeSchema = z.enum(TTS_LANGUAGE_DETECTION_MODES)
export type TTSLanguageDetectionMode = z.infer<typeof ttsLanguageDetectionModeSchema>

export const MIN_TTS_RATE = -100
export const MAX_TTS_RATE = 100
export const MIN_TTS_PITCH = -100
export const MAX_TTS_PITCH = 100
export const MIN_TTS_VOLUME = -100
export const MAX_TTS_VOLUME = 100

export const ttsRateSchema = z.coerce.number().int().min(MIN_TTS_RATE).max(MAX_TTS_RATE)
export const ttsPitchSchema = z.coerce.number().int().min(MIN_TTS_PITCH).max(MAX_TTS_PITCH)
export const ttsVolumeSchema = z.coerce.number().int().min(MIN_TTS_VOLUME).max(MAX_TTS_VOLUME)

export const ttsConfigSchema = z.object({
  defaultVoice: ttsVoiceSchema,
  languageVoices: z.record(langCodeISO6393Schema, ttsVoiceSchema),
  detectLanguageMode: ttsLanguageDetectionModeSchema,
  rate: ttsRateSchema,
  pitch: ttsPitchSchema,
  volume: ttsVolumeSchema,
})

export type TTSConfig = z.infer<typeof ttsConfigSchema>
