export const DOWNLOAD_TRANSLATED_SUBTITLES_PREPARING_MESSAGE_DELAY_MS = 600

export const DOWNLOAD_TRANSLATED_SUBTITLES_MESSAGE_TONE = {
  Muted: "muted",
  Success: "success",
} as const

export type DownloadTranslatedSubtitlesMessageTone
  = typeof DOWNLOAD_TRANSLATED_SUBTITLES_MESSAGE_TONE[keyof typeof DOWNLOAD_TRANSLATED_SUBTITLES_MESSAGE_TONE]
