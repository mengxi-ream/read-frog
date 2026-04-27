import { i18n } from "#imports"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/base-ui/button"
import { Input } from "@/components/ui/base-ui/input"
import { SPLIT_TRANSLATOR_COMMAND } from "@/entrypoints/background/split-translator-command"
import { getExtensionCommandShortcut } from "@/utils/extension-command-shortcut"
import { openExtensionShortcutSettings } from "@/utils/navigation"
import { formatPageTranslationShortcut } from "@/utils/page-translation-shortcut"
import { ConfigCard } from "../../components/config-card"

const BROWSER_COMMAND_SHORTCUT_MODIFIER_MAP: Record<string, string> = {
  Command: "Meta",
  Ctrl: "Control",
  MacCtrl: "Control",
}

function normalizeBrowserCommandShortcut(shortcut: string): string {
  return shortcut
    .split("+")
    .map(part => BROWSER_COMMAND_SHORTCUT_MODIFIER_MAP[part] ?? part)
    .join("+")
}

export function SplitTranslatorShortcut() {
  const [shortcut, setShortcut] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void getExtensionCommandShortcut(SPLIT_TRANSLATOR_COMMAND)
      .then((nextShortcut) => {
        if (!cancelled) {
          setShortcut(nextShortcut)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShortcut("")
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleOpenShortcutSettings = () => {
    void openExtensionShortcutSettings().catch(() => {
      toast.error(i18n.t("options.translation.splitTranslatorShortcut.openFailed"))
    })
  }

  const displayShortcut = shortcut === null
    ? ""
    : shortcut
      ? formatPageTranslationShortcut(normalizeBrowserCommandShortcut(shortcut)) || shortcut
      : i18n.t("options.translation.splitTranslatorShortcut.unset")

  return (
    <ConfigCard
      id="split-translator-shortcut"
      title={i18n.t("options.translation.splitTranslatorShortcut.title")}
      description={i18n.t("options.translation.splitTranslatorShortcut.description")}
    >
      <div className="flex max-w-sm flex-col gap-3">
        <Input
          aria-label={i18n.t("options.translation.splitTranslatorShortcut.title")}
          readOnly
          value={displayShortcut}
        />
        <Button type="button" variant="outline" onClick={handleOpenShortcutSettings}>
          {i18n.t("options.translation.splitTranslatorShortcut.openSettings")}
        </Button>
      </div>
    </ConfigCard>
  )
}
