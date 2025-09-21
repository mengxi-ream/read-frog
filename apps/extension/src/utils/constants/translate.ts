export const MIN_TRANSLATE_RATE = 1
export const MIN_TRANSLATE_CAPACITY = 1
export const MIN_BATCH_CHARACTERS = 1
export const MIN_BATCH_SIZE = 1

export const DEFAULT_REQUEST_RATE = 8
export const DEFAULT_REQUEST_CAPACITY = 200

export const DEFAULT_BATCH_CHARACTERS = 1000
export const DEFAULT_BATCH_MIN_BATCH_SIZE = 4
export const DEFAULT_BATCH_MAX_TASK_RETRIES = 3

export const DEFAULT_BATCH_CONFIG = {
  batchCharacters: DEFAULT_BATCH_CHARACTERS,
  batchSize: DEFAULT_BATCH_MIN_BATCH_SIZE,
}

export const DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY = ['alt', 'q']

export const CUSTOM_DONT_WALK_INTO_ELEMENT_SELECTOR_MAP: Record<string, string[]> = {
  'chatgpt.com': [
    '.ProseMirror',
  ],
}
