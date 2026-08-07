import { Icon } from "@iconify/react"
import { useAtomValue } from "jotai"
import { browser } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { Kbd, KbdGroup } from "@/components/ui/base-ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { TRANSLATION_HUB_PAGE_PATH } from "@/utils/constants/translation-hub"
import { i18n } from "@/utils/i18n"
import { formatHotkeyParts } from "@/utils/os"
import { isPageTranslationShortcutEmpty } from "@/utils/page-translation-shortcut"

export function TranslationHubButton() {
  const translationHub = useAtomValue(configFieldsAtomMap.translationHub)

  const handleClick = async () => {
    await browser.tabs.create({
      url: browser.runtime.getURL(TRANSLATION_HUB_PAGE_PATH),
    })
  }

  // The hub is buried enough that people ask where it lives; the tooltip is the
  // one place that can teach the shortcut at the moment they reach for it.
  const shortcutParts = isPageTranslationShortcutEmpty(translationHub.shortcut)
    ? []
    : formatHotkeyParts(translationHub.shortcut)

  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={handleClick} />}>
        <Icon icon="tabler:language-hiragana" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[200px] text-wrap">
        {i18n.t("popup.hub.tooltip")}
        {shortcutParts.length > 0 && (
          <KbdGroup className="mt-1.5 flex">
            {shortcutParts.map((part) => (
              <Kbd key={part}>{part}</Kbd>
            ))}
          </KbdGroup>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
