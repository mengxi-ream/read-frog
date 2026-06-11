import { useAtomValue } from "jotai"
import { browser, i18n } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_SIDE_PANEL_TRANSLATION_SHORTCUT_KEY } from "@/utils/constants/translate"
import { sendMessage } from "@/utils/message"
import { formatHotkey } from "@/utils/os"
import { cn } from "@/utils/styles/utils"

export function SplitTranslationHubButton({
  className,
}: {
  className?: string
}) {
  const translateConfig = useAtomValue(configFieldsAtomMap.translate)
  const shortcut = translateConfig.page.sidePanelShortcut ?? DEFAULT_SIDE_PANEL_TRANSLATION_SHORTCUT_KEY

  const openSidePanel = async () => {
    const [currentTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })

    if (currentTab.id !== undefined) {
      try {
        await sendMessage("openTranslationHubSidePanel", undefined, currentTab.id)
        window.close()
        return
      }
      catch {
        // Some pages cannot receive content-script messages. Fall back to a tab.
      }
    }

    await browser.tabs.create({ url: browser.runtime.getURL("/translation-hub.html") })
  }

  const shortcutSuffix = shortcut?.trim() ? ` (${formatHotkey(shortcut)})` : ""

  return (
    <Button
      onClick={() => void openSidePanel()}
      className={cn("min-w-0", className)}
    >
      <span className="truncate">{`${i18n.t("popup.splitTranslation")}${shortcutSuffix}`}</span>
    </Button>
  )
}
