// Timing constants
export const NAVIGATION_HANDLER_DELAY = 1000
export const FETCH_CHECK_INTERVAL = 100
export const FETCH_SUBTITLES_TIMEOUT = 10_000
export const MAX_GAP_MS = 2_000
export const PAUSE_TIMEOUT_MS = 1_000

// Segmentation constants
export const MAX_WORDS = 15
export const MAX_CHARS_CJK = 30
export const SENTENCE_END_PATTERN = /[,.。?？！!；;…؟۔\n]$/

// On-demand translation constants
export const TRANSLATION_BATCH_SIZE = 5
export const TRANSLATE_LOOK_AHEAD_MS = 30_000
export const PROCESS_LOOK_AHEAD_MS = 60_000
export const MAX_LOOKAHEAD_RATE = 4

// DOM IDs
export const READ_FROG_SUBTITLES_UI_HOST_ID = "read-frog-subtitles-ui-host"
export const TRANSLATE_BUTTON_CONTAINER_ID = "read-frog-subtitles-translate-button-container"
export const HIDE_NATIVE_CAPTIONS_STYLE_ID = "read-frog-hide-native-captions"

// Class names
export const SUBTITLES_VIEW_CLASS = "read-frog-subtitles-view"
// The box the two subtitle lines sit in. Everything else about it is Tailwind utilities, but
// custom CSS needs a name it can hold on to, so this one is part of the public contract.
export const SUBTITLES_BOX_CLASS = "read-frog-subtitles-box"
export const STATE_MESSAGE_CLASS = "read-frog-subtitles-state-message"
export const TRANSLATE_BUTTON_CLASS = "read-frog-subtitles-translate-button"

// YouTube specific
export const YOUTUBE_WATCH_URL_PATTERN = "youtube.com/watch"
export const YOUTUBE_EMBED_PATH_PATTERN = /\/embed\/[^/?]+/
export const YOUTUBE_SHORTS_PATH_PATTERN = /\/shorts\/[^/?]+/
export const YOUTUBE_LIVE_PATH_PATTERN = /\/live\/[^/?]+/
export const YOUTUBE_NAVIGATE_START_EVENT = "yt-navigate-start"
export const YOUTUBE_NAVIGATE_FINISH_EVENT = "yt-navigate-finish"
export const YOUTUBE_NATIVE_SUBTITLES_CLASS = ".ytp-caption-window-container"
export const PLAYER_DATA_REQUEST_TYPE = "READ_FROG_GET_PLAYER_DATA"
export const PLAYER_DATA_RESPONSE_TYPE = "READ_FROG_PLAYER_DATA"
export const WAIT_TIMEDTEXT_REQUEST_TYPE = "READ_FROG_WAIT_TIMEDTEXT"
export const WAIT_TIMEDTEXT_RESPONSE_TYPE = "READ_FROG_TIMEDTEXT_READY"
export const TIMEDTEXT_WAIT_TIMEOUT_MS = 5000
export const ENSURE_SUBTITLES_REQUEST_TYPE = "READ_FROG_ENSURE_SUBTITLES"
export const ENSURE_SUBTITLES_RESPONSE_TYPE = "READ_FROG_ENSURE_SUBTITLES_DONE"
export const POST_MESSAGE_TIMEOUT_MS = 6000

// YouTube player wait constants
export const MAX_PLAYER_WAIT_ATTEMPTS = 50
export const PLAYER_WAIT_INTERVAL_MS = 100
export const MAX_STATE_WAIT_ATTEMPTS = 20
export const STATE_WAIT_INTERVAL_MS = 300
export const MAX_FETCH_RETRIES = 5
export const FETCH_RETRY_DELAY_MS = 1000
export const MAX_POT_WAIT_ATTEMPTS = 30
export const POT_WAIT_INTERVAL_MS = 200
export const MAX_SELECTED_TRACK_WAIT_ATTEMPTS = 8
export const SELECTED_TRACK_WAIT_INTERVAL_MS = 100

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
export const DEFAULT_FONT_FAMILY = "system" as const
export const DEFAULT_SUBTITLE_COLOR = "#FFFFFF"
export const DEFAULT_DISPLAY_MODE = "bilingual" as const
export const DEFAULT_TRANSLATION_POSITION = "above" as const
export const DEFAULT_CONTROLS_HEIGHT = 60
export const DEFAULT_SUBTITLE_POSITION = { percent: 10, anchor: "bottom" } as const
// Mnemonic for "captions", and it echoes YouTube's own `C` key without taking it over.
export const DEFAULT_SUBTITLES_TOGGLE_SHORTCUT_KEY = "Alt+C"
// Subtitle controls sit on top of arbitrary host pages, so keep their theme fixed for readability.
export const SUBTITLES_THEME = "dark" as const

// Font family mapping
export const SUBTITLE_FONT_FAMILIES = {
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  roboto: "Roboto, sans-serif",
  "noto-sans": '"Noto Sans", "Noto Sans SC", "Noto Sans JP", "Noto Sans KR", sans-serif',
  "noto-serif": '"Noto Serif", "Noto Serif SC", "Noto Serif JP", "Noto Serif KR", serif',
}

// Custom CSS
// The three class hooks above (view, box, and the two line classes) are what custom CSS targets.
// Presets are appended into the editor as plain text, so each one is a self-contained block that
// only touches properties none of the sliders own — that way stacking two of them never conflicts
// with a font size or colour the user already picked.
export const SUBTITLE_CSS_PRESET_IDS = [
  "blurTranslation",
  "dashedTranslation",
  "dimOriginal",
] as const
export type SubtitleCssPresetId = (typeof SUBTITLE_CSS_PRESET_IDS)[number]

export const SUBTITLE_CSS_PRESETS: Record<SubtitleCssPresetId, string> = {
  // Hover the line itself rather than the box: the outer view is pointer-events: none, and the
  // box is wider than the text, so revealing on the text is both simpler and more deliberate.
  blurTranslation: `.subtitles-translation {
  filter: blur(6px);
  transition: filter 0.15s ease;
}

.subtitles-translation:hover {
  filter: none;
}`,
  dashedTranslation: `.subtitles-translation {
  text-decoration: underline dashed;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.25em;
}`,
  dimOriginal: `.subtitles-main {
  opacity: 0.6;
}`,
}

// Subtitles source
export const SUBTITLES_SOURCE = { NATIVE: "native", AI: "ai" } as const
export type SubtitlesSource = (typeof SUBTITLES_SOURCE)[keyof typeof SUBTITLES_SOURCE]
