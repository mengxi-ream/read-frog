// Timing constants
export const NAVIGATION_HANDLER_DELAY = 1000
export const FETCH_CHECK_INTERVAL = 100
export const FETCH_SUBTITLES_TIMEOUT = 10_000
export const MAX_GAP_MS = 2_000
export const PAUSE_TIMEOUT_MS = 1_000

// Segmentation constants
export const MAX_WORDS = 15
export const MAX_WORDS_EXTENDED = 25
export const MAX_CHARS_CJK = 30
export const SENTENCE_END_PATTERN = /[,.。?？！!；;…؟۔\n]$/

// Batch translation constants
export const FIRST_BATCH_DURATION_MS = 50_000
export const SUBSEQUENT_BATCH_DURATION_MS = 60_000
export const PRELOAD_AHEAD_MS = 40_000

// DOM IDs
export const TRANSLATE_BUTTON_CONTAINER_ID = 'read-frog-subtitles-translate-button-container'
export const HIDE_NATIVE_CAPTIONS_STYLE_ID = 'read-frog-hide-native-captions'

// Class names
export const SUBTITLES_VIEW_CLASS = 'read-frog-subtitles-view'
export const STATE_MESSAGE_CLASS = 'read-frog-subtitles-state-message'
export const TRANSLATE_BUTTON_CLASS = 'read-frog-subtitles-translate-button'

// YouTube specific
export const YOUTUBE_WATCH_URL_PATTERN = 'youtube.com/watch'
export const YOUTUBE_NAVIGATE_EVENT = 'yt-navigate-finish'
export const SUBTITLE_INTERCEPT_MESSAGE_TYPE = 'WXT_YT_SUBTITLE_INTERCEPT'
export const YOUTUBE_NATIVE_SUBTITLES_CLASS = '.ytp-caption-window-container'

// Subtitle style constants
export const MIN_FONT_SCALE = 30
export const MAX_FONT_SCALE = 150
export const DEFAULT_FONT_SCALE = 100
export const MIN_FONT_WEIGHT = 300
export const MAX_FONT_WEIGHT = 700
export const DEFAULT_FONT_WEIGHT = 400
export const MIN_BACKGROUND_OPACITY = 0
export const MAX_BACKGROUND_OPACITY = 100
export const DEFAULT_BACKGROUND_OPACITY = 75
export const DEFAULT_FONT_FAMILY = 'system' as const
export const DEFAULT_SUBTITLE_COLOR = '#FFFFFF'
export const DEFAULT_DISPLAY_MODE = 'bilingual' as const
export const DEFAULT_TRANSLATION_POSITION = 'above' as const

// Font family mapping
export const SUBTITLE_FONT_FAMILIES = {
  'system': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  'roboto': 'Roboto, sans-serif',
  'noto-sans': '"Noto Sans", "Noto Sans SC", "Noto Sans JP", "Noto Sans KR", sans-serif',
  'noto-serif': '"Noto Serif", "Noto Serif SC", "Noto Serif JP", "Noto Serif KR", serif',
}
