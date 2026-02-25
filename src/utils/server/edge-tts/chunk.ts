import { EDGE_TTS_MAX_CHUNK_BYTES, EDGE_TTS_MAX_CHUNKS } from "./constants"
import { EdgeTTSError } from "./errors"

const SOFT_BOUNDARY_CHARS = /[\s。！？；.!?؛۔]/
const ENTITY_START_CHAR = "&"
const ENTITY_END_CHAR = ";"

function measureBytes(text: string): number {
  return new TextEncoder().encode(text).length
}

function isHighSurrogateCode(code: number): boolean {
  return code >= 0xD800 && code <= 0xDBFF
}

function isLowSurrogateCode(code: number): boolean {
  return code >= 0xDC00 && code <= 0xDFFF
}

function alignToCodePointBoundary(text: string, index: number): number {
  if (index <= 0 || index >= text.length) {
    return index
  }

  const previousCode = text.charCodeAt(index - 1)
  const currentCode = text.charCodeAt(index)
  if (isHighSurrogateCode(previousCode) && isLowSurrogateCode(currentCode)) {
    return index - 1
  }

  return index
}

function findLargestSliceByBytes(text: string, maxBytes: number): number {
  let low = 1
  let high = text.length
  let best = 0

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const safeMiddle = alignToCodePointBoundary(text, middle)
    const slice = text.slice(0, safeMiddle)
    const bytes = measureBytes(slice)
    if (bytes <= maxBytes) {
      best = safeMiddle
      low = middle + 1
    }
    else {
      high = middle - 1
    }
  }

  return alignToCodePointBoundary(text, best)
}

function adjustBySoftBoundary(text: string, candidate: number): number {
  if (candidate >= text.length) {
    return candidate
  }

  const floor = Math.max(1, Math.floor(candidate * 0.6))
  for (let index = candidate; index >= floor; index--) {
    const char = text[index - 1]
    if (char && SOFT_BOUNDARY_CHARS.test(char)) {
      return index
    }
  }

  return candidate
}

function adjustByEntityBoundary(text: string, candidate: number): number {
  if (candidate <= 0 || candidate >= text.length) {
    return candidate
  }

  const left = text.slice(0, candidate)
  const ampIndex = left.lastIndexOf(ENTITY_START_CHAR)
  if (ampIndex === -1) {
    return candidate
  }

  const semicolonInLeft = left.indexOf(ENTITY_END_CHAR, ampIndex)
  if (semicolonInLeft !== -1) {
    return candidate
  }

  const semicolonInRight = text.indexOf(ENTITY_END_CHAR, candidate)
  if (semicolonInRight !== -1) {
    return ampIndex
  }

  return candidate
}

export function splitTextByUtf8Bytes(
  text: string,
  maxChunkBytes = EDGE_TTS_MAX_CHUNK_BYTES,
  maxChunks = EDGE_TTS_MAX_CHUNKS,
): string[] {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new EdgeTTSError("INVALID_TEXT", "Text to speech input is empty")
  }

  const chunks: string[] = []
  let remaining = trimmed

  while (remaining.length > 0) {
    let splitAt = findLargestSliceByBytes(remaining, maxChunkBytes)

    if (splitAt <= 0) {
      throw new EdgeTTSError("INVALID_TEXT", "Unable to split input text safely")
    }

    splitAt = adjustBySoftBoundary(remaining, splitAt)
    splitAt = adjustByEntityBoundary(remaining, splitAt)

    if (splitAt <= 0) {
      splitAt = findLargestSliceByBytes(remaining, maxChunkBytes)
    }

    const chunk = remaining.slice(0, splitAt).trim()
    if (!chunk) {
      throw new EdgeTTSError("INVALID_TEXT", "Encountered an empty chunk while splitting text")
    }

    chunks.push(chunk)
    if (chunks.length > maxChunks) {
      throw new EdgeTTSError(
        "TEXT_TOO_LONG",
        `Text is too long for Edge TTS (max ${maxChunks} chunks at ${maxChunkBytes} bytes each)`,
      )
    }

    remaining = remaining.slice(splitAt).trim()
  }

  return chunks
}
