import type { ColorOption } from '../../types/highlight'

export const COLOR_OPTIONS: ColorOption[] = [
  { color: '#fff3cd', name: 'Yellow' },
  { color: '#f8d7da', name: 'Red' },
  { color: '#d1ecf1', name: 'Blue' },
  { color: '#d4edda', name: 'Green' },
  { color: '#e2e3e5', name: 'Gray' },
  { color: '#f5c6cb', name: 'Pink' },
]

export const DEFAULT_HIGHLIGHT_COLOR = '#fff3cd'

export const STORAGE_KEY = 'read-frog-highlights'

export const HIGHLIGHT_ATTRIBUTE = 'data-read-frog-highlight'
export const HIGHLIGHT_GROUP_ATTRIBUTE = 'data-highlight-group'
export const HIGHLIGHT_ID_ATTRIBUTE = 'data-highlight-id'
