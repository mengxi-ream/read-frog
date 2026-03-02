import type { SubtitlesFragment } from "../types"
import { PAUSE_TIMEOUT_MS, SENTENCE_END_PATTERN } from "@/utils/constants/subtitles"
import { getMaxLength, getTextLength, isCJKLanguage } from "@/utils/subtitles/utils"

const QUALITY_LENGTH_THRESHOLD = 250
const QUALITY_PERCENTAGE_THRESHOLD = 0.2
const STARTS_WITH_SIGN_PATTERN = /^[[(♪]/

// Preferred target range (best-effort) for rebalancing short lines.
const TARGET_MIN_CJK = 15
const TARGET_MAX_CJK = 25
const TARGET_MIN_NON_CJK = 11
const TARGET_MAX_NON_CJK = 20

const PAUSE_WORDS = new Set([
  "actually",
  "also",
  "although",
  "and",
  "anyway",
  "as",
  "basically",
  "because",
  "but",
  "eventually",
  "frankly",
  "honestly",
  "hopefully",
  "however",
  "if",
  "instead",
  "just",
  "like",
  "literally",
  "maybe",
  "meanwhile",
  "nevertheless",
  "nonetheless",
  "now",
  "okay",
  "or",
  "otherwise",
  "perhaps",
  "personally",
  "probably",
  "right",
  "since",
  "so",
  "suddenly",
  "then",
  "therefore",
  "though",
  "thus",
  "unless",
  "until",
  "well",
  "while",
])

function cleanText(text: string): string {
  return text.replace(/^>>\s*/, "").replace(/>>/g, " ").trim()
}

function getFirstWord(text: string): string {
  return text.toLowerCase().split(/\s+/)[0] || ""
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
  let bufferLength = 0
  const isCJK = isCJKLanguage(language)
  const separator = isCJK ? "" : " "
  const maxLength = getMaxLength(isCJK)

  const flushBuffer = () => {
    if (buffer.length === 0)
      return
    result.push({
      text: buffer.map(s => s.text).join(separator).trim(),
      start: buffer[0].start,
      end: buffer[buffer.length - 1].end,
    })
    buffer.length = 0
    bufferLength = 0
  }

  for (let i = 0; i < fragments.length; i++) {
    const frag = fragments[i]
    if (!frag.text)
      continue

    const text = cleanText(frag.text)
    if (!text)
      continue
    const fragLength = getTextLength(text, isCJK)
    const lastSegment = buffer[buffer.length - 1]

    if (lastSegment) {
      const isEndOfSentence = SENTENCE_END_PATTERN.test(lastSegment.text)
      const isTimeout = frag.start - lastSegment.end > PAUSE_TIMEOUT_MS
      const wouldExceedLimit = bufferLength + fragLength > maxLength

      const startsWithSign = STARTS_WITH_SIGN_PATTERN.test(frag.text)
      const startsWithPauseWord = usePause
        && PAUSE_WORDS.has(getFirstWord(frag.text))
        && buffer.length > 1

      if (isEndOfSentence || isTimeout || wouldExceedLimit || startsWithSign || startsWithPauseWord) {
        flushBuffer()
      }
    }

    buffer.push({ text, start: frag.start, end: frag.end })
    bufferLength += fragLength
  }

  flushBuffer()
  return result
}

function getTargetBounds(isCJK: boolean): { min: number, max: number } {
  return isCJK
    ? { min: TARGET_MIN_CJK, max: TARGET_MAX_CJK }
    : { min: TARGET_MIN_NON_CJK, max: TARGET_MAX_NON_CJK }
}

function mergeSegmentPair(
  left: SubtitlesFragment,
  right: SubtitlesFragment,
  separator: string,
): SubtitlesFragment {
  return {
    ...left,
    text: `${left.text}${separator}${right.text}`.trim(),
    end: right.end,
  }
}

function shouldKeepBoundary(left: SubtitlesFragment, right: SubtitlesFragment): boolean {
  const isTimeout = right.start - left.end > PAUSE_TIMEOUT_MS
  const startsWithSign = STARTS_WITH_SIGN_PATTERN.test(right.text)
  return isTimeout || startsWithSign
}

function rebalanceToTargetRange(
  fragments: SubtitlesFragment[],
  language: string,
): SubtitlesFragment[] {
  if (fragments.length <= 1) {
    return fragments
  }

  const isCJK = isCJKLanguage(language)
  const separator = isCJK ? "" : " "
  const { min, max } = getTargetBounds(isCJK)

  const result: SubtitlesFragment[] = []

  for (let i = 0; i < fragments.length; i++) {
    let current = { ...fragments[i] }
    let currentLength = getTextLength(current.text, isCJK)

    while (currentLength < min && i + 1 < fragments.length) {
      const next = fragments[i + 1]
      const nextLength = getTextLength(next.text, isCJK)
      const combinedLength = currentLength + nextLength

      if (combinedLength > max || shouldKeepBoundary(current, next)) {
        break
      }

      current = mergeSegmentPair(current, next, separator)
      currentLength = combinedLength
      i++
    }

    result.push(current)
  }

  for (let i = result.length - 1; i > 0; i--) {
    const current = result[i]
    const currentLength = getTextLength(current.text, isCJK)
    if (currentLength >= min) {
      continue
    }

    const previous = result[i - 1]
    const previousLength = getTextLength(previous.text, isCJK)
    const combinedLength = previousLength + currentLength

    if (combinedLength > max || shouldKeepBoundary(previous, current)) {
      continue
    }

    result[i - 1] = mergeSegmentPair(previous, current, separator)
    result.splice(i, 1)
  }

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

  return rebalanceToTargetRange(result, language)
}
