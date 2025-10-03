export const MIN_TRANSLATE_RATE = 1
export const MIN_TRANSLATE_CAPACITY = 1
export const MIN_BATCH_CHARACTERS = 1
export const MIN_BATCH_ITEMS = 1

export const DEFAULT_REQUEST_RATE = 8
export const DEFAULT_REQUEST_CAPACITY = 60

export const DEFALT_MAX_CHARACTER_PER_BATCH = 1000
export const DEFAULT_MAX_ITEMS_PER_BATCH = 4
export const DEFAULT_BATCH_MAX_TASK_RETRIES = 3

export const DEFAULT_BATCH_CONFIG = {
  maxCharactersPerBatch: DEFALT_MAX_CHARACTER_PER_BATCH,
  maxItemsPerBatch: DEFAULT_MAX_ITEMS_PER_BATCH,
}

export const DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY = ['alt', 'q']

export const CUSTOM_DONT_WALK_INTO_ELEMENT_SELECTOR_MAP: Record<string, string[]> = {
  'chatgpt.com': [
    '.ProseMirror',
  ],
}
