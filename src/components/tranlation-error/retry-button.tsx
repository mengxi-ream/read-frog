import type { TransNode } from '@/types/dom'
import { RotateCcw } from 'lucide-react'
import { use } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translateConsecutiveInlineNodes, translateNode } from '@/utils/host/translate/node-manipulation'
import { ShadowWrapperContext } from '@/utils/react-shadow-host/create-shadow-host'

export function RetryButton({ node }: { node: TransNode | TransNode[] }) {
  const shadowWrapper = use(ShadowWrapperContext)

  const handleRetry = async () => {
    if (Array.isArray(node)) {
      await translateConsecutiveInlineNodes(node)
    }
    else {
      await translateNode(node)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleRetry}
        >
          <RotateCcw
            className="size-3.5 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
          />
        </button>
      </TooltipTrigger>
      <TooltipContent container={shadowWrapper}>
        Retry translation
      </TooltipContent>
    </Tooltip>
  )
}
