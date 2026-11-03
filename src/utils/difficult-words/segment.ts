import { VOCAB_JUDGE_MAX_WORDS, VOCAB_WORD_MAX_LENGTH } from "@read-frog/api-contract"

// A paragraph as `vocab.judge` takes it: its distinct words as written, in
// the order they first appear, and which of them only ever begin a sentence
// (their capital says nothing about being a name). Kept with each word: where
// it appears, so the marks can be painted over every occurrence.

export interface WordSpan {
  start: number
  end: number
}

export interface SegmentedWords {
  words: string[]
  /** Indexes into `words` of the words seen only at the start of a sentence. */
  starts: number[]
  /** For each word of `words`, where it appears in the text. */
  spans: WordSpan[][]
}

const LETTER = /\p{L}/u

let wordSegmenter: Intl.Segmenter | null = null
let sentenceSegmenter: Intl.Segmenter | null = null

/** Where each sentence of `text` starts, in order. */
function sentenceStarts(text: string): number[] {
  sentenceSegmenter ??= new Intl.Segmenter(undefined, { granularity: "sentence" })
  return Array.from(sentenceSegmenter.segment(text), (segment) => segment.index)
}

/**
 * The words of `text`, as `vocab.judge` takes them. Numbers and words longer
 * than the contract allows are left out; past `maxWords` distinct words, the
 * rest of the paragraph is not sent.
 */
export function segmentWords(text: string, maxWords = VOCAB_JUDGE_MAX_WORDS): SegmentedWords {
  wordSegmenter ??= new Intl.Segmenter(undefined, { granularity: "word" })
  const sentences = sentenceStarts(text)
  const words: string[] = []
  const spans: WordSpan[][] = []
  const onlyAtStarts: boolean[] = []
  const indexOf = new Map<string, number>()

  let nextSentence = 0
  // Whether the next word is the first of its sentence.
  let atSentenceStart = true
  for (const segment of wordSegmenter.segment(text)) {
    while (nextSentence < sentences.length && sentences[nextSentence]! <= segment.index) {
      nextSentence += 1
      atSentenceStart = true
    }
    if (!segment.isWordLike) {
      continue
    }
    const isStart = atSentenceStart
    atSentenceStart = false
    const word = segment.segment
    if (word.length > VOCAB_WORD_MAX_LENGTH || !LETTER.test(word)) {
      continue
    }

    let index = indexOf.get(word)
    if (index === undefined) {
      if (words.length >= maxWords) {
        continue
      }
      index = words.length
      indexOf.set(word, index)
      words.push(word)
      spans.push([])
      onlyAtStarts.push(true)
    }
    spans[index]!.push({ start: segment.index, end: segment.index + word.length })
    if (!isStart) {
      onlyAtStarts[index] = false
    }
  }

  const starts: number[] = []
  onlyAtStarts.forEach((only, index) => {
    if (only) starts.push(index)
  })
  return { words, starts, spans }
}

const TEXT_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u
/** Enough of a paragraph to tell its script by. */
const SCRIPT_SAMPLE_LENGTH = 400

/**
 * Whether a paragraph is written without spaces between words (Chinese,
 * Japanese): then it is sent as text and the server finds the words. A
 * character of those scripts is about a syllable, a letter a fraction of one,
 * so each weighs four letters: Chinese prose full of English names is still
 * Chinese, and an English one quoting a Chinese phrase still English.
 */
export function isTextScript(text: string): boolean {
  let otherLetters = 0
  let textScript = 0
  for (const char of text.slice(0, SCRIPT_SAMPLE_LENGTH)) {
    if (!LETTER.test(char)) continue
    if (TEXT_SCRIPT.test(char)) textScript += 1
    else otherLetters += 1
  }
  return textScript > 0 && textScript * 4 >= otherLetters
}
