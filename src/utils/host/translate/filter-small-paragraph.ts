import type { LanguageTag } from "@read-frog/definitions"
import type { Config } from "@/types/config/config"
import { getDetectedCodeFromStorage, getFinalSourceCode } from "@/utils/config/languages"
import { getDocumentSiteRule } from "@/utils/site-rules/effective"

const PURE_HANDLE_RE = /^@\S+$/u

function countWords(text: string, sourceCode: LanguageTag): number {
  const segmenter = new Intl.Segmenter(sourceCode, { granularity: "word" })
  return [...segmenter.segment(text)].filter((s) => s.isWordLike).length
}

async function getSourceCode(configSourceCode: LanguageTag | "auto"): Promise<LanguageTag> {
  const detectedCode = await getDetectedCodeFromStorage()
  return getFinalSourceCode(configSourceCode, detectedCode)
}

export async function shouldFilterSmallParagraph(text: string, config: Config): Promise<boolean> {
  if (PURE_HANDLE_RE.test(text.trim())) return true

  const siteRule = getDocumentSiteRule(config)
  const minCharactersPerNode =
    siteRule.minCharacters ?? config.pageTranslation.page.minCharactersPerNode
  const minWordsPerNode = siteRule.minWords ?? config.pageTranslation.page.minWordsPerNode
  const { sourceCode } = config.language

  if (minCharactersPerNode > 0 && text.length < minCharactersPerNode) return true

  if (minWordsPerNode > 0) {
    const finalSourceCode = await getSourceCode(sourceCode)
    if (countWords(text, finalSourceCode) < minWordsPerNode) return true
  }

  return false
}
