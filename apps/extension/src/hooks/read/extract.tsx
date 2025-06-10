import type { LangCodeISO6393 } from '@/types/config/languages'
import type { ExtractedContent } from '@/types/content'

import { Readability } from '@mozilla/readability'
import { useQuery } from '@tanstack/react-query'

import { franc } from 'franc-min'
import { useSetAtom } from 'jotai'
import { flattenToParagraphs } from '@/entrypoints/side.content/utils/article'
import { configFields } from '@/utils/atoms/config'
import { isDontWalkIntoElement } from '@/utils/host/dom/filter'

function removeDummyNodes(root: Document) {
  const elements = root.querySelectorAll('*')
  elements.forEach((element) => {
    if (element instanceof HTMLElement && isDontWalkIntoElement(element)) {
      element.remove()
    }
  })
}

export function useExtractContent() {
  const setLanguage = useSetAtom(configFields.language)

  return useQuery<ExtractedContent>({
    queryKey: ['extractContent'],
    queryFn: async () => {
      const documentClone = document.cloneNode(true)
      removeDummyNodes(documentClone as Document)
      const article = new Readability(documentClone as Document, {
        serializer: el => el,
      }).parse()
      const paragraphs = article?.content
        ? flattenToParagraphs(article.content)
        : []

      // TODO: in analyzing, we should re-extract the article in case it changed, and reset the lang
      const lang = article?.textContent ? franc(article.textContent) : 'und'

      logger.log('franc detected lang', lang)

      setLanguage({
        detectedCode: lang === 'und' ? 'eng' : (lang as LangCodeISO6393),
      })

      return {
        article: {
          ...article,
          lang,
        },
        paragraphs,
      }
    },
  })
}
