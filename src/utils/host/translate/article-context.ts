import { Readability } from "@mozilla/readability"
import { removeDummyNodes } from "@/utils/content/utils"
import { logger } from "@/utils/logger"

let cachedTextContent: { url: string, textContent: string } | null = null

async function fetchPageTextContent(): Promise<string> {
  try {
    const documentClone = document.cloneNode(true) as Document
    await removeDummyNodes(documentClone)
    const article = new Readability(documentClone, { serializer: el => el }).parse()
    if (article?.textContent)
      return article.textContent
  }
  catch (error) {
    logger.warn("Readability parsing failed, falling back to body textContent:", error)
  }
  return document.body?.textContent || ""
}

export async function getOrFetchArticleData(
  enableAIContentAware: boolean,
): Promise<{ title: string, textContent?: string } | null> {
  if (typeof window === "undefined" || typeof document === "undefined")
    return null

  const title = document.title || ""
  if (!enableAIContentAware)
    return { title }

  const currentUrl = window.location.href
  if (cachedTextContent?.url === currentUrl) {
    return { title, textContent: cachedTextContent.textContent }
  }

  const textContent = await fetchPageTextContent()
  cachedTextContent = { url: currentUrl, textContent }

  return { title, textContent }
}
