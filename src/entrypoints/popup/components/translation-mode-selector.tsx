import type { TranslationMode as TranslationModeType } from "@/types/config/translate"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue } from "jotai"
import { Button } from "@/components/ui/base-ui/button"
import { Kbd, KbdGroup } from "@/components/ui/base-ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { formatHotkeyParts } from "@/utils/os"
import { isPageTranslationShortcutEmpty } from "@/utils/page-translation-shortcut"
import { canEnterTranslationOnlyMode } from "@/utils/providers/translation-only-gate"
import { cn } from "@/utils/styles/utils"

const TABLER_ICON_STROKE_WIDTH_CLASS = "[&_path]:[stroke-width:1.2]"

const MODE_ICON: Record<TranslationModeType, { icon: string; className?: string }> = {
  bilingual: { icon: "garden:translation-exists-stroke-16" },
  translationOnly: { icon: "tabler:text-resize", className: TABLER_ICON_STROKE_WIDTH_CLASS },
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
  const config = useAtomValue(configAtom)
  const currentMode = translateConfig.mode
  const currentModeIcon = MODE_ICON[currentMode]
  const nextMode = NEXT_MODE[currentMode]
  const tooltipKey = MODE_TOOLTIP_KEY[currentMode]
  // Entering translationOnly is blocked while the page-translate provider has
  // no markup support (translation-only-gate.ts). Native `disabled` would
  // swallow the hover events the tooltip needs, so the button stays focusable
  // and the click becomes a no-op with the reason shown in the tooltip.
  const nextModeBlocked = nextMode === "translationOnly" && !canEnterTranslationOnlyMode(config)
  const actionLabel = i18n.t(tooltipKey.action)
  const shortcutParts = isPageTranslationShortcutEmpty(translateConfig.modeShortcut)
    ? []
    : formatHotkeyParts(translateConfig.modeShortcut)

  const handleModeToggle = () => {
    if (nextModeBlocked) return
    void setTranslateConfig({ mode: nextMode })
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={actionLabel}
            aria-disabled={nextModeBlocked || undefined}
            className={cn(nextModeBlocked && "cursor-not-allowed opacity-50")}
            onClick={handleModeToggle}
          />
        }
      >
        <Icon
          {...currentModeIcon}
          className={cn(currentModeIcon.className, currentMode === "translationOnly" && "size-4.5")}
        />
      </TooltipTrigger>
      <TooltipContent>
        {/* The blocked-reason line is much longer than the mode labels; let it
            wrap inside the 320px popup instead of forcing one clipped line. */}
        <div className={cn("whitespace-nowrap", nextModeBlocked && "max-w-64 whitespace-normal")}>
          <p>{i18n.t(tooltipKey.current)}</p>
          {nextModeBlocked ? (
            <p>{i18n.t("options.translation.preference.translationMode.microsoftNotSupported")}</p>
          ) : (
            <p>{actionLabel}</p>
          )}
          {!nextModeBlocked && shortcutParts.length > 0 && (
            <KbdGroup className="mt-1.5">
              {shortcutParts.map((part) => (
                <Kbd key={part}>{part}</Kbd>
              ))}
            </KbdGroup>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
