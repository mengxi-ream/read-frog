import type { ExtractedContent } from '@/types/content'
import { useQuery } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { configFields } from '@/utils/atoms/config'
import { getDocumentInfo } from '@/utils/content'
import { logger } from '@/utils/logger'

export function useExtractContent() {
  const setLanguage = useSetAtom(configFields.language)

  return useQuery<ExtractedContent | null>({
    queryKey: ['extractContent'],
    queryFn: async () => {
      try {
        // TODO: in analyzing, we should re-extract the article in case it changed, and reset the lang
        const { detectedCode, lang, paragraphs, article } = getDocumentInfo()

        logger.log('franc detected lang', lang)

        void setLanguage({ detectedCode })

        return {
          article: {
            ...article,
            lang,
          },
          paragraphs,
        }
      }
      catch (error) {
        logger.error('Failed to extract content from document:', error)
        return null
      }
    },
  })
}
