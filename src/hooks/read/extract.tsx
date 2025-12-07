import type { ExtractedContent } from '@/types/content'
import { useQuery } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { detectedCodeAtom } from '@/utils/atoms/detected-code'
import { getDocumentInfo } from '@/utils/content/analyze'
import { logger } from '@/utils/logger'

export function useExtractContent() {
  const setDetectedCode = useSetAtom(detectedCodeAtom)

  return useQuery<ExtractedContent | null>({
    queryKey: ['extractContent'],
    queryFn: async () => {
      try {
        // TODO: in analyzing, we should re-extract the article in case it changed, and reset the lang
        const { detectedCodeOrUnd, paragraphs, article } = await getDocumentInfo()

        logger.log('detected lang', detectedCodeOrUnd)

        void setDetectedCode(detectedCodeOrUnd === 'und' ? 'eng' : detectedCodeOrUnd)

        return {
          article: {
            ...article,
            lang: detectedCodeOrUnd,
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
