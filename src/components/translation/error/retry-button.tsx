import { Icon } from "@iconify/react"
import { useAtomValue } from "jotai"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { configAtom } from "@/utils/atoms/config"
import { translateNodesBilingualMode, translateNodeTranslationOnlyMode } from "@/utils/host/translate/node-manipulation"

export function RetryButton({ nodes }: { nodes: ChildNode[] }) {
  const config = useAtomValue(configAtom)
  const translationMode = config.translate.mode

  const handleRetry = async () => {
    const walkId = crypto.randomUUID()
    if (translationMode === "bilingual") {
      await translateNodesBilingualMode(nodes, walkId, config)
    }
    else if (translationMode === "translationOnly") {
      await translateNodeTranslationOnlyMode(nodes, walkId, config)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={(
          <button
            type="button"
            onClick={handleRetry}
          />
        )}
      >
        <Icon icon="tabler:reload" className="size-4 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400" />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="notranslate">
        Retry translation
      </TooltipContent>
    </Tooltip>
  )
}
