// Turns difficult-word marking on and off in the tab. Alt+Shift, like the
// toolbar keys; V for "vocabulary". Chrome and Edge keep A, B, I, L, M, N, S
// and T for themselves.
export const DEFAULT_DIFFICULT_WORDS_SHORTCUT_KEY = "Alt+Shift+V"

// The key: a config without one has the default key, an empty one has none.
export function getDifficultWordsShortcut(difficultWords: { shortcut?: string }) {
  return difficultWords.shortcut ?? DEFAULT_DIFFICULT_WORDS_SHORTCUT_KEY
}
