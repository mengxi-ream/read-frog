import { Icon } from '@iconify/react'
import { useMutationState } from '@tanstack/react-query'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useExtractContent } from '@/hooks/read/extract'
import { useReadArticle } from '@/hooks/read/read'
import { getFaviconUrl } from '@/utils/content'
import { onMessage } from '@/utils/message'
import { cn } from '@/utils/tailwind'
import { isSideOpenAtom } from '../../atoms'

export function Metadata({ className }: { className?: string }) {
  const title = document.title ?? 'Untitled'
  const favicon = getFaviconUrl()
  const {
    mutate: readArticle,
    analyzeContent,
    explainArticle,
  } = useReadArticle()
  const { isPending: isExtractingContent, data: extractedContent }
    = useExtractContent()
  const explainData = useMutationState({
    filters: {
      mutationKey: ['explainArticle'],
    },
    select: mutation => mutation.state.data,
  })
  // TODO: show regenerate button at certain conditions and implement the logic

  const setIsSideOpen = useSetAtom(isSideOpenAtom)

  useEffect(() => {
    const removeListener = onMessage('readArticle', () => {
      setIsSideOpen(true)
      if (!extractedContent) {
        toast.warning('Waiting content to be extracted...')
        return
      }
      if (analyzeContent.isPending || explainArticle.isPending) {
        toast.warning('Reading in progress...')
        return
      }
      readArticle()
    })

    return () => {
      removeListener()
    }
  }, [extractedContent, analyzeContent, explainArticle, setIsSideOpen, readArticle])

  return (
    <div
      className={cn(
        'relative flex items-center justify-between gap-x-2 rounded-md bg-neutral-100 px-2 py-2 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-x-2">
        {favicon && (
          <img
            src={favicon}
            alt="Favicon"
            className="h-4 w-4 flex-shrink-0 rounded-xs"
          />
        )}
        <h1 className="truncate text-base font-semibold">{title}</h1>
      </div>
      <Button
        size="sm"
        onClick={() => extractedContent && readArticle()}
        disabled={
          isExtractingContent
          || analyzeContent.isPending
          || explainArticle.isPending
        }
      >
        {explainData.length > 0 && explainData[explainData.length - 1]
          ? (
              <>
                <Icon icon="tabler:reload" className="size-3" />
                Regenerate
              </>
            )
          : (
              <>
                <Icon icon="tabler:book" className="size-3" />
                Read
              </>
            )}
      </Button>
    </div>
  )
}
