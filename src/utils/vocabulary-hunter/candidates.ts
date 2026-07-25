export type VocabularyStatus = "known" | "fuzzy" | "unknown"
export type VocabularyLevel = "p" | "m" | "h" | "4" | "6" | "g" | "o"

export interface VocabularyWordInfo {
  lemma: string
  level: VocabularyLevel
  index: number
}

export interface WordOccurrence {
  word: string
  level?: VocabularyLevel
  start: number
  end: number
}

const BASIC_WORDS = new Set(
  [
    "about",
    "after",
    "again",
    "against",
    "almost",
    "also",
    "always",
    "among",
    "another",
    "around",
    "because",
    "before",
    "being",
    "between",
    "both",
    "could",
    "does",
    "doing",
    "during",
    "each",
    "every",
    "first",
    "from",
    "going",
    "good",
    "great",
    "have",
    "having",
    "here",
    "into",
    "itself",
    "just",
    "know",
    "like",
    "little",
    "long",
    "made",
    "make",
    "many",
    "might",
    "more",
    "most",
    "much",
    "must",
    "never",
    "only",
    "other",
    "over",
    "people",
    "really",
    "right",
    "same",
    "should",
    "since",
    "some",
    "something",
    "still",
    "such",
    "take",
    "than",
    "that",
    "their",
    "them",
    "then",
    "there",
    "these",
    "they",
    "thing",
    "think",
    "this",
    "those",
    "through",
    "time",
    "under",
    "very",
    "want",
    "well",
    "were",
    "what",
    "when",
    "where",
    "which",
    "while",
    "will",
    "with",
    "would",
    "year",
    "your",
  ].map((word) => word.toLowerCase()),
)

export function normalizeWord(word: string) {
  return word.toLocaleLowerCase("en-US").replace(/[’']/g, "'")
}

export function findCandidateWords(
  text: string,
  minimumLength: number,
  statuses: Record<string, VocabularyStatus>,
  dictionary?: Map<string, VocabularyWordInfo>,
  enabledLevels?: ReadonlySet<VocabularyLevel>,
) {
  const segmenter = new Intl.Segmenter("en-US", { granularity: "word" })
  const occurrences: WordOccurrence[] = []

  for (const segment of segmenter.segment(text)) {
    if (!segment.isWordLike) continue

    const word = normalizeWord(segment.segment)
    const wordInfo = dictionary?.get(word)
    const lemma = wordInfo?.lemma ?? word
    if (
      word.length < minimumLength ||
      (!dictionary && BASIC_WORDS.has(word)) ||
      statuses[lemma] === "known" ||
      (wordInfo && enabledLevels && !enabledLevels.has(wordInfo.level)) ||
      (dictionary && !wordInfo) ||
      !/^[a-z]+(?:'[a-z]+)?$/i.test(word)
    ) {
      continue
    }

    occurrences.push({
      word: lemma,
      level: wordInfo?.level,
      start: segment.index,
      end: segment.index + segment.segment.length,
    })
  }

  return occurrences
}
