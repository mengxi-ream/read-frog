import { i18n } from "#imports"
import { toast } from "sonner"
import { Button } from "@/components/ui/base-ui/button"
import { openExtensionShortcutSettings } from "@/utils/navigation"
import { ConfigCard } from "../../components/config-card"

const DEFAULT_SPLIT_TRANSLATOR_SHORTCUT = "Alt+S"

export function SplitTranslatorShortcut() {
  const handleOpenShortcutSettings = () => {
    void openExtensionShortcutSettings().catch(() => {
      toast.error(i18n.t("options.translation.splitTranslatorShortcut.openFailed"))
    })
  }

  return (
    <ConfigCard
      id="split-translator-shortcut"
      title={i18n.t("options.translation.splitTranslatorShortcut.title")}
      description={`${i18n.t("options.translation.splitTranslatorShortcut.description")}:${DEFAULT_SPLIT_TRANSLATOR_SHORTCUT}`}
    >
      <Button type="button" variant="outline" onClick={handleOpenShortcutSettings}>
        {i18n.t("options.translation.splitTranslatorShortcut.openSettings")}
      </Button>
    </ConfigCard>
  )
}
