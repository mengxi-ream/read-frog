import type { LangCodeISO6393 } from '@read-frog/definitions'
import type { Config } from '@/types/config/config'
import { ISO6393_TO_6391 } from '@read-frog/definitions'
import { getDetectedCodeFromStorage, getFinalSourceCode } from '@/utils/config/languages'

function countWords(text: string, sourceCode: LangCodeISO6393): number {
  // Convert ISO 639-3 (e.g., 'eng') to ISO 639-1 (e.g., 'en') for Intl.Segmenter
  const locale = ISO6393_TO_6391[sourceCode] ?? 'en'
  const segmenter = new Intl.Segmenter(locale, { granularity: 'word' })
  return [...segmenter.segment(text)].filter(s => s.isWordLike).length
}

async function getSourceCode(configSourceCode: LangCodeISO6393 | 'auto'): Promise<LangCodeISO6393> {
  const detectedCode = await getDetectedCodeFromStorage()
  return getFinalSourceCode(configSourceCode, detectedCode)
}

export async function shouldFilterSmallParagraph(
  text: string,
  config: Config,
): Promise<boolean> {
  const { minCharactersPerNode, minWordsPerNode } = config.translate.page
  const { sourceCode } = config.language

  if (minCharactersPerNode > 0 && text.length < minCharactersPerNode)
    return true

  if (minWordsPerNode > 0) {
    const finalSourceCode = await getSourceCode(sourceCode)
    if (countWords(text, finalSourceCode) < minWordsPerNode)
      return true
  }

  return false
}
