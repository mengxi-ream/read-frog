import type { SubtitlesFragment } from '../types'
import { MAX_WORDS, PAUSE_TIMEOUT_MS, SENTENCE_END_PATTERN } from '@/utils/constants/subtitles'

const QUALITY_LENGTH_THRESHOLD = 250
const QUALITY_PERCENTAGE_THRESHOLD = 0.2

const PAUSE_WORDS = new Set([
  'actually',
  'also',
  'although',
  'and',
  'anyway',
  'as',
  'basically',
  'because',
  'but',
  'eventually',
  'frankly',
  'honestly',
  'hopefully',
  'however',
  'if',
  'instead',
  'just',
  'like',
  'literally',
  'maybe',
  'meanwhile',
  'nevertheless',
  'nonetheless',
  'now',
  'okay',
  'or',
  'otherwise',
  'perhaps',
  'personally',
  'probably',
  'right',
  'since',
  'so',
  'suddenly',
  'then',
  'therefore',
  'though',
  'thus',
  'unless',
  'until',
  'well',
  'while',
])

function isCJKLanguage(lang: string): boolean {
  return ['zh', 'ja', 'ko', 'th', 'lo', 'km', 'my'].some(l => lang.startsWith(l))
}

function getWordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function cleanText(text: string): string {
  return text.replace(/^>>\s*/, '').replace(/>>/g, ' ').trim()
}

function getFirstWord(text: string): string {
  return text.toLowerCase().split(/\s+/)[0] || ''
}

function isQualityPoor(fragments: SubtitlesFragment[]): boolean {
  if (fragments.length === 0)
    return false
  const longCount = fragments.filter(f => f.text.length > QUALITY_LENGTH_THRESHOLD).length
  return longCount / fragments.length > QUALITY_PERCENTAGE_THRESHOLD
}

interface BufferSegment {
  text: string
  start: number
  end: number
}

function processSubtitles(
  fragments: SubtitlesFragment[],
  language: string,
  usePause: boolean = false,
): SubtitlesFragment[] {
  const result: SubtitlesFragment[] = []
  const buffer: BufferSegment[] = []
  let bufferWordCount = 0
  const separator = isCJKLanguage(language) ? '' : ' '

  const flushBuffer = () => {
    if (buffer.length === 0)
      return
    result.push({
      text: buffer.map(s => s.text).join(separator).trim(),
      start: buffer[0].start,
      end: buffer[buffer.length - 1].end,
    })
    buffer.length = 0
    bufferWordCount = 0
  }

  for (let i = 0; i < fragments.length; i++) {
    const frag = fragments[i]
    if (!frag.text)
      continue

    const text = cleanText(frag.text)
    if (!text)
      continue
    const fragWordCount = getWordCount(text)
    const lastSegment = buffer[buffer.length - 1]

    if (lastSegment) {
      const isEndOfSentence = SENTENCE_END_PATTERN.test(lastSegment.text)
      const isTimeout = frag.start - lastSegment.end > PAUSE_TIMEOUT_MS
      const wouldExceedLimit = bufferWordCount + fragWordCount > MAX_WORDS

      const startsWithSign = /^[[(♪]/.test(frag.text)
      const startsWithPauseWord = usePause
        && PAUSE_WORDS.has(getFirstWord(frag.text))
        && buffer.length > 1

      if (isEndOfSentence || isTimeout || wouldExceedLimit || startsWithSign || startsWithPauseWord) {
        flushBuffer()
      }
    }

    buffer.push({ text, start: frag.start, end: frag.end })
    bufferWordCount += fragWordCount
  }

  flushBuffer()
  return result
}

export function optimizeSubtitles(
  fragments: SubtitlesFragment[],
  language: string,
): SubtitlesFragment[] {
  if (fragments.length === 0)
    return []

  // First pass without aggressive pause detection
  let result = processSubtitles(fragments, language, false)

  // Quality check: if too many long lines, re-process with pause detection
  if (isQualityPoor(result)) {
    result = processSubtitles(fragments, language, true)
  }

  return result
}
