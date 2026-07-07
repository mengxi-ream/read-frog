import { useAtom, useAtomValue } from "jotai"
import { browser } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { Kbd, KbdGroup } from "@/components/ui/base-ui/kbd"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { formatHotkeyParts } from "@/utils/os.ts"
import { isPageTranslationShortcutEmpty } from "@/utils/page-translation-shortcut"
import { cn } from "@/utils/styles/utils"
import { isPageTranslatedAtom } from "../atoms/auto-translate"
import { isIgnoreTabAtom } from "../atoms/ignore"
import { isCurrentSiteInBlacklistAtom, isCurrentSiteInWhitelistAtom } from "../atoms/site-control"

export default function TranslateButton({ className }: { className?: string }) {
  const [isPageTranslated, setIsPageTranslated] = useAtom(isPageTranslatedAtom)
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)
  const translateConfig = useAtomValue(configFieldsAtomMap.translate)
  const { mode } = useAtomValue(configFieldsAtomMap.siteControl)
  const isCurrentSiteInWhitelist = useAtomValue(isCurrentSiteInWhitelistAtom)
  const isCurrentSiteInBlacklist = useAtomValue(isCurrentSiteInBlacklistAtom)

  const toggleTranslation = async () => {
    const [currentTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })

    if (currentTab.id) {
      const nextEnabled = !isPageTranslated
      void sendMessage("tryToSetEnablePageTranslationByTabId", {
        tabId: currentTab.id,
        enabled: nextEnabled,
        analyticsContext: nextEnabled
          ? createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.POPUP)
          : undefined,
      })

      setIsPageTranslated(prev => !prev)
    }
  }

  const isSiteBlocked = mode === "whitelist" ? !isCurrentSiteInWhitelist : isCurrentSiteInBlacklist
  const isDisabled = isIgnoreTab || isSiteBlocked
  const shortcutParts = isPageTranslationShortcutEmpty(translateConfig.page.shortcut)
    ? []
    : formatHotkeyParts(translateConfig.page.shortcut)

  return (
    <Button
      onClick={toggleTranslation}
      disabled={isDisabled}
      className={cn(
        "min-w-0",
        className,
      )}
    >
      <span className="flex max-w-full min-w-0 items-center justify-center gap-2">
        <span className="min-w-0 truncate">
          {isPageTranslated ? i18n.t("popup.showOriginal") : i18n.t("popup.translate")}
        </span>
        {!isPageTranslated && shortcutParts.length > 0 && (
          <KbdGroup className="shrink-0">
            {shortcutParts.map(part => (
              <Kbd
                key={part}
                className="bg-primary-foreground/20 text-primary-foreground"
              >
                {part}
              </Kbd>
            ))}
          </KbdGroup>
        )}
      </span>
    </Button>
  )
}
