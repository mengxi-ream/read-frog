import type { VocabularyLevel, VocabularyWordInfo } from "./candidates"
import { browser } from "#imports"

export const VOCABULARY_LEVELS: Array<{
  id: VocabularyLevel
  label: string
  description: string
  rank: number
}> = [
  { id: "p", label: "基础 A1", description: "小学与最高频基础词", rank: 1 },
  { id: "m", label: "基础 A2", description: "初中常用词", rank: 2 },
  { id: "h", label: "高中 / B1", description: "高中核心词汇", rank: 3 },
  { id: "4", label: "CET-4 / B2", description: "大学英语四级词汇", rank: 4 },
  { id: "6", label: "CET-6 / IELTS", description: "六级及雅思常见进阶词", rank: 5 },
  { id: "g", label: "TOEFL / GRE", description: "托福、GRE 学术词汇", rank: 6 },
  { id: "o", label: "学术扩展", description: "词库中的其他低频词", rank: 7 },
]

let dictionaryPromise: Promise<Map<string, VocabularyWordInfo>> | null = null

export function loadVocabularyDictionary() {
  // WXT narrows getURL to HTML entrypoints, while this public text asset is also emitted.
  // oxlint-disable-next-line typescript/unbound-method
  const getRuntimeUrl = browser.runtime.getURL as (path: string) => string
  dictionaryPromise ??= fetch(getRuntimeUrl("vocabulary/eng-dict.txt"))
    .then((response) => {
      if (!response.ok) throw new Error(`Vocabulary dictionary: ${response.status}`)
      return response.text()
    })
    .then((text) => {
      const dictionary = new Map<string, VocabularyWordInfo>()
      const lemmaIndices = new Map<string, number>()
      text.split("\n").forEach((line) => {
        const [word, lemma, level] = line.trim().split(/\s+/)
        if (!word || !lemma || !level) return
        let index = lemmaIndices.get(lemma)
        if (index === undefined) {
          index = lemmaIndices.size
          lemmaIndices.set(lemma, index)
        }
        dictionary.set(word, { lemma, level: level as VocabularyLevel, index })
      })
      return dictionary
    })

  return dictionaryPromise
}

export function getVocabularyLevel(level: VocabularyLevel | undefined) {
  return VOCABULARY_LEVELS.find((item) => item.id === level) ?? VOCABULARY_LEVELS.at(-1)!
}
