import type { ArticleAnalysis, ArticleExplanation } from '@/types/content'
import { useMutationState } from '@tanstack/react-query'

import { useAtom, useAtomValue } from 'jotai'

import { toast } from 'sonner'
import LoadingDots from '@/components/loading-dots'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
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

  // const handleReadForMe = () => {
  //   if (!extractedContent?.paragraphs.join("\n").trim()) {
  //     toast.error("Cannot read the content: content is not available");
  //     return;
  //   }
  //   readArticle(extractedContent);
  // };

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

  if (isExtractingContent) {
    return (
      <div className="flex h-full w-full flex-1 items-center justify-center gap-x-2 p-4">
        <LoadingDots />
        Extracting content...
      </div>
    )
  }

  if (readState === 'analyzing') {
    return (
      <div className="flex h-full w-full flex-1 items-center justify-center gap-x-2 p-4">
        <LoadingDots />
        Analyzing...
      </div>
    )
  }

  if (readState === 'continue?') {
    return (
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
    )
  }

  if (readState === 'explaining') {
    return (
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
    )
  }
  return (
    <>
      {explainDataList.length > 0
        && explainDataList[explainDataList.length - 1]
        ? (
            <ScrollArea className="h-full flex-1">
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
    </>
  )
}
