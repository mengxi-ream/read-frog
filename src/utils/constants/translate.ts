export const MIN_TRANSLATE_RATE = 0.01
export const MIN_TRANSLATE_CAPACITY = 1
export const MIN_BATCH_CHARACTERS = 1
export const MIN_BATCH_ITEMS = 1

export const DEFAULT_REQUEST_RATE = 8
export const DEFAULT_REQUEST_CAPACITY = 20

export const DEFAULT_MAX_CHARACTER_PER_BATCH = 1000
export const DEFAULT_MAX_ITEMS_PER_BATCH = 4

export const DEFAULT_BATCH_CONFIG = {
  maxCharactersPerBatch: DEFAULT_MAX_CHARACTER_PER_BATCH,
  maxItemsPerBatch: DEFAULT_MAX_ITEMS_PER_BATCH,
}

// Request timeout for LLM batch translations scales with batch size: a full
// 4000-char batch on a slow free-tier model cannot finish in the 20s that fits
// a single paragraph. 4000 chars → 20s + 60s = 80s.
export const BATCH_TIMEOUT_BASE_MS = 20_000
export const BATCH_TIMEOUT_PER_CHAR_MS = 15
export const MAX_BATCH_TIMEOUT_MS = 120_000

export const DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY = "Alt+E"
export const DEFAULT_TRANSLATION_MODE_SHORTCUT_KEY = "Alt+Shift+M"
export const DEFAULT_SELECTION_TRANSLATION_SHORTCUT_KEY = "Alt+T"

export const MIN_PRELOAD_MARGIN = 0
export const MAX_PRELOAD_MARGIN = 10000
export const DEFAULT_PRELOAD_MARGIN = 1000

export const MIN_PRELOAD_THRESHOLD = 0
export const MAX_PRELOAD_THRESHOLD = 1
export const DEFAULT_PRELOAD_THRESHOLD = 0

// A single observed paragraph taller than this many viewports is split into
// its descendant paragraphs before observation, otherwise one flat giant
// container (e.g. docs.docker.com's 185k-px <article>) defeats viewport-lazy
// translation and enqueues the whole page at once (#1881).
export const GIANT_PARAGRAPH_SPLIT_VIEWPORT_MULTIPLIER = 3
// Floor for the viewport height used in the split cap, so tiny embedded
// frames don't shred normal paragraphs into fragments.
export const GIANT_PARAGRAPH_SPLIT_MIN_VIEWPORT_PX = 800
// Defensive bound on split recursion.
export const GIANT_PARAGRAPH_MAX_SPLIT_DEPTH = 10

export const MIN_CHARACTERS_PER_NODE = 0
export const MAX_CHARACTERS_PER_NODE = 1000
export const DEFAULT_MIN_CHARACTERS_PER_NODE = 0

export const MIN_WORDS_PER_NODE = 0
export const MAX_WORDS_PER_NODE = 100
export const DEFAULT_MIN_WORDS_PER_NODE = 0
