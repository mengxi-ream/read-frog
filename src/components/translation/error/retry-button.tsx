import { IconReload } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { use } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { configAtom } from "@/utils/atoms/config"
import { getRandomUUID } from "@/utils/crypto-polyfill"
import { translateNodesBilingualMode, translateNodeTranslationOnlyMode } from "@/utils/host/translate/node-manipulation"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"

export function RetryButton({ nodes }: { nodes: ChildNode[] }) {
  const shadowWrapper = use(ShadowWrapperContext)
  const config = useAtomValue(configAtom)
  const translationMode = config.translate.mode

  const handleRetry = async () => {
    const walkId = getRandomUUID()
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
        <IconReload className="size-4 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400" />
      </TooltipTrigger>
      <TooltipContent container={shadowWrapper} side="bottom" className="notranslate">
        Retry translation
      </TooltipContent>
    </Tooltip>
  )
}
