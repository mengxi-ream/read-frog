import commonWords from "./built-in/common-words.json"

// Frequency-ranked English word list (Peter Norvig's Google Web Trillion Word
// Corpus count, no-swears variant). Index + 1 = frequency rank; absent words
// are rarer than every listed word.
let wordRankMap: Map<string, number> | null = null

function getWordRankMap(): Map<string, number> {
  if (!wordRankMap) {
    wordRankMap = new Map(commonWords.map((word, index) => [word, index + 1]))
  }
  return wordRankMap
}

export const COMMON_WORD_COUNT = commonWords.length

/** 1-based frequency rank, or undefined when the word is not in the list. */
export function getWordRank(word: string): number | undefined {
  return getWordRankMap().get(word)
}
