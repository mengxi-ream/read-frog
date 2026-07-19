// Frequency-ranked English word list, sourced at build time from the
// `most-common-words-by-language` package (MIT) instead of being vendored
// into this repo — one word per line, most frequent first. Index + 1 =
// frequency rank; absent words are rarer than every listed word.
import englishWordListRaw from "most-common-words-by-language/build/resources/english.txt?raw"

let wordRankMap: Map<string, number> | null = null

function getWordRankMap(): Map<string, number> {
  if (!wordRankMap) {
    const words = englishWordListRaw.split("\n").filter((word) => word.length > 0)
    wordRankMap = new Map(words.map((word, index) => [word, index + 1]))
  }
  return wordRankMap
}

/** 1-based frequency rank, or undefined when the word is not in the list. */
export function getWordRank(word: string): number | undefined {
  return getWordRankMap().get(word)
}
