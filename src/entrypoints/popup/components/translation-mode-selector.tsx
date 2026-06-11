import type { TranslationMode as TranslationModeType } from "@/types/config/translate"
import { Icon } from "@iconify/react"
import { useAtom } from "jotai"
import { i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { configFieldsAtomMap } from "@/utils/atoms/config"

const MODE_ICON: Record<TranslationModeType, { icon: string, className?: string, strokeWidth?: number }> = {
  bilingual: { icon: "system-uicons:translate", strokeWidth: 1.6 },
  translationOnly: { icon: "mingcute:text-area-line" },
}

const NEXT_MODE: Record<TranslationModeType, TranslationModeType> = {
  bilingual: "translationOnly",
  translationOnly: "bilingual",
}

const MODE_TOOLTIP_KEY = {
  bilingual: {
    current: "popup.translationModeToggle.tooltip.bilingual.current",
    action: "popup.translationModeToggle.tooltip.bilingual.action",
  },
  translationOnly: {
    current: "popup.translationModeToggle.tooltip.translationOnly.current",
    action: "popup.translationModeToggle.tooltip.translationOnly.action",
  },
} as const

export default function TranslationModeSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const currentMode = translateConfig.mode
  const nextMode = NEXT_MODE[currentMode]
  const tooltipKey = MODE_TOOLTIP_KEY[currentMode]
  const actionLabel = i18n.t(tooltipKey.action)

  const handleModeToggle = () => {
    void setTranslateConfig(
      { mode: nextMode },
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={(
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={actionLabel}
            onClick={handleModeToggle}
          />
        )}
      >
        <Icon {...MODE_ICON[currentMode]} className="size-4.5" />
      </TooltipTrigger>
      <TooltipContent>
        <div className="whitespace-nowrap">
          <p>{i18n.t(tooltipKey.current)}</p>
          <p>{actionLabel}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
