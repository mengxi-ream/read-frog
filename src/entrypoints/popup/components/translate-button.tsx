import { useAtom, useAtomValue } from "jotai"
import { browser } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { Kbd, KbdGroup } from "@/components/ui/base-ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { formatHotkeyParts } from "@/utils/os.ts"
import { isShortcutEmpty } from "@/utils/shortcut"
import { cn } from "@/utils/styles/utils"
import { isPageTranslatedAtom } from "../atoms/auto-translate"
import { isIgnoreTabAtom } from "../atoms/ignore"
import { isCurrentSiteInBlacklistAtom, isCurrentSiteInWhitelistAtom } from "../atoms/site-control"

export default function TranslateButton({ className }: { className?: string }) {
  const [isPageTranslated, setIsPageTranslated] = useAtom(isPageTranslatedAtom)
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)
  const translateConfig = useAtomValue(configFieldsAtomMap.pageTranslation)
  const { mode } = useAtomValue(configFieldsAtomMap.siteControl)
  const isCurrentSiteInWhitelist = useAtomValue(isCurrentSiteInWhitelistAtom)
  const isCurrentSiteInBlacklist = useAtomValue(isCurrentSiteInBlacklistAtom)

  const toggleTranslation = async () => {
    const [currentTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })

    if (currentTab!.id) {
      const nextEnabled = !isPageTranslated
      void sendMessage("tryToSetEnablePageTranslationByTabId", {
        tabId: currentTab!.id,
        enabled: nextEnabled,
        analyticsContext: nextEnabled
          ? createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.POPUP)
          : undefined,
      })

      setIsPageTranslated((prev) => !prev)
    }
  }

  const isSiteBlocked = mode === "whitelist" ? !isCurrentSiteInWhitelist : isCurrentSiteInBlacklist
  const isDisabled = isIgnoreTab || isSiteBlocked
  const shortcutParts = isShortcutEmpty(translateConfig.page.shortcut)
    ? []
    : formatHotkeyParts(translateConfig.page.shortcut)

  const label = isPageTranslated ? i18n.t("popup.showOriginal") : i18n.t("popup.translate")
  // `data-fit-label`: the difficult-words button beside it gives up its label
  // before this one is cut short (see difficult-words-button.tsx).
  const content = (
    <span data-fit-label className="min-w-0 truncate">
      {label}
    </span>
  )

  // The key sits in the tooltip, as on the Translation Hub button: on the
  // button it left no room for the difficult-words button beside it.
  if (shortcutParts.length === 0) {
    return (
      <Button
        onClick={toggleTranslation}
        disabled={isDisabled}
        className={cn("min-w-0", className)}
      >
        {content}
      </Button>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            onClick={toggleTranslation}
            disabled={isDisabled}
            className={cn("min-w-0", className)}
          />
        }
      >
        {content}
      </TooltipTrigger>
      <TooltipContent className="has-data-[slot=kbd]:pr-3">
        {label}
        <KbdGroup>
          {shortcutParts.map((part) => (
            <Kbd key={part}>{part}</Kbd>
          ))}
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  )
}
