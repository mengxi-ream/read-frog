import type { ArticleAnalysis, ArticleExplanation } from '@/types/content'
import { Button } from '@repo/ui/components/button'
import { Progress } from '@repo/ui/components/progress'
import { ScrollArea } from '@repo/ui/components/scroll-area'
import { useMutationState } from '@tanstack/react-query'
import { useAtom, useAtomValue } from 'jotai'
import { Activity } from 'react'
import { toast } from 'sonner'
import LoadingDots from '@/components/loading-dots'
import { useExtractContent } from '@/hooks/read/extract'
import { useExplainArticle } from '@/hooks/read/read'
import { progressAtom, readStateAtom } from '../../atoms'
import Explanation from './explanation'

export default function Content() {
  const progress = useAtomValue(progressAtom)
  const [readState, setReadState] = useAtom(readStateAtom)
  const { isPending: isExtractingContent, data: extractedContent }
    = useExtractContent()
  const { mutate: explainArticle } = useExplainArticle()

  const explainDataList = useMutationState({
    filters: {
      mutationKey: ['explainArticle'],
    },
    select: mutation => mutation.state.data,
  })

  const analyzeContentDataList = useMutationState({
    filters: {
      mutationKey: ['analyzeContent'],
    },
    select: mutation => mutation.state.data,
  })

  const handleContinue = () => {
    const analyzeContentData
      = analyzeContentDataList[analyzeContentDataList.length - 1]
    if (extractedContent && analyzeContentData) {
      explainArticle({
        extractedContent,
        articleAnalysis: analyzeContentData as ArticleAnalysis,
      })
      setReadState('explaining')
    }
    else {
      toast.error('Cannot generate the explanation: content is not available')
    }
  }

  const isShowingExplanation = !isExtractingContent
    && readState !== 'analyzing'
    && readState !== 'continue?'
    && readState !== 'explaining'

  return (
    <>
      <Activity mode={isExtractingContent ? 'visible' : 'hidden'}>
        <div className="flex h-full w-full flex-1 items-center justify-center gap-x-2 p-4">
          <LoadingDots />
          Extracting content...
        </div>
      </Activity>

      <Activity mode={readState === 'analyzing' ? 'visible' : 'hidden'}>
        <div className="flex h-full w-full flex-1 items-center justify-center gap-x-2 p-4">
          <LoadingDots />
          Analyzing...
        </div>
      </Activity>

      <Activity mode={readState === 'continue?' ? 'visible' : 'hidden'}>
        <div className="flex h-full w-full flex-1 items-center justify-center gap-x-2 p-4">
          <div className="flex flex-col gap-6">
            <p>
              The content does not appear to be an article or book. Are you sure
              you want to proceed?
            </p>
            <Button className="mx-auto" onClick={handleContinue}>
              Continue
            </Button>
          </div>
        </div>
      </Activity>

      <Activity mode={readState === 'explaining' ? 'visible' : 'hidden'}>
        <div className="flex h-full w-full flex-1 items-center justify-center gap-x-2 p-4">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <LoadingDots />
              Generating...
            </div>
            <Progress
              value={
                progress.total !== 0
                  ? (progress.completed / progress.total) * 100
                  : 0
              }
            />
          </div>
        </div>
      </Activity>

      <Activity mode={isShowingExplanation ? 'visible' : 'hidden'}>
        {explainDataList.length > 0
          && explainDataList[explainDataList.length - 1]
          ? (
              <ScrollArea className="h-0 flex-1">
                <Explanation
                  articleExplanation={
                    explainDataList[
                      explainDataList.length - 1
                    ] as ArticleExplanation['paragraphs']
                  }
                />
              </ScrollArea>
            )
          : null}
      </Activity>
    </>
  )
}
