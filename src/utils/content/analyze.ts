import type { LangCodeISO6393 } from '@read-frog/definitions'
import type { DetectionSource } from '@/utils/content/language'
import { Readability } from '@mozilla/readability'
import { flattenToParagraphs } from '@/entrypoints/side.content/utils/article'
import { detectLanguageWithSource } from '@/utils/content/language'
import { getLocalConfig } from '../config/storage'
import { logger } from '../logger'
import { removeDummyNodes } from './utils'

export type { DetectionSource } from '@/utils/content/language'

export async function getDocumentInfo(): Promise<{
  article: ReturnType<Readability<Node>['parse']>
  paragraphs: string[]
  detectedCodeOrUnd: LangCodeISO6393 | 'und'
  detectionSource: DetectionSource
}> {
  const documentClone = document.cloneNode(true)
  await removeDummyNodes(documentClone as Document)
  const article = new Readability(documentClone as Document, {
    serializer: el => el,
  }).parse()
  const paragraphs = article?.content
    ? flattenToParagraphs(article.content)
    : []

  logger.info('article', article)

  // Get config to check if LLM detection is enabled
  const config = await getLocalConfig()

  // Combine title and content for detection
  const title = article?.title || ''
  const content = article?.textContent || ''
  const textForDetection = `${title}\n\n${content}`

  // Detect language with optional LLM enhancement
  const enableLLM = !!(config?.translate.page.enableLLMDetection && config?.translate.page.autoTranslateLanguages?.length > 0)
  const { code: detectedCodeOrUnd, source: detectionSource } = await detectLanguageWithSource(textForDetection, {
    enableLLM,
    maxLengthForLLM: 1500,
  })

  logger.info('final detectionSource', detectionSource)
  logger.info('final detectedCodeOrUnd', detectedCodeOrUnd)

  return {
    article,
    paragraphs,
    detectedCodeOrUnd,
    detectionSource,
  }
}
