import type { SubtitlesFragment } from "../types"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"

const MS_BATCH_MAX_ELEMENTS = 100
const MS_BATCH_MAX_CHARACTERS = 50_000

function chunkFragments(fragments: SubtitlesFragment[]): SubtitlesFragment[][] {
  const chunks: SubtitlesFragment[][] = []
  let currentChunk: SubtitlesFragment[] = []
  let currentCharCount = 0

  for (const fragment of fragments) {
    const textLength = fragment.text.length

    if (currentChunk.length > 0
      && (currentChunk.length >= MS_BATCH_MAX_ELEMENTS
        || currentCharCount + textLength > MS_BATCH_MAX_CHARACTERS)) {
      chunks.push(currentChunk)
      currentChunk = []
      currentCharCount = 0
    }

    currentChunk.push(fragment)
    currentCharCount += textLength
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }

  return chunks
}

export async function microsoftWarmupTranslate(
  fragments: SubtitlesFragment[],
  fromLang: string,
  toLang: string,
): Promise<SubtitlesFragment[]> {
  if (fragments.length === 0) {
    return []
  }

  const chunks = chunkFragments(fragments)
  const results = await Promise.allSettled(
    chunks.map(chunk =>
      sendMessage("microsoftBatchTranslate", {
        texts: chunk.map(f => f.text),
        fromLang,
        toLang,
      }),
    ),
  )

  const translatedFragments = [...fragments]
  let globalIndex = 0

  for (let i = 0; i < chunks.length; i++) {
    const result = results[i]
    const chunk = chunks[i]

    if (result.status === "fulfilled") {
      const translations = result.value
      for (let j = 0; j < chunk.length; j++) {
        translatedFragments[globalIndex + j] = {
          ...translatedFragments[globalIndex + j],
          translation: translations[j],
        }
      }
    }
    else {
      logger.warn(`Microsoft warmup chunk ${i} failed:`, result.reason)
    }

    globalIndex += chunk.length
  }

  return translatedFragments
}
