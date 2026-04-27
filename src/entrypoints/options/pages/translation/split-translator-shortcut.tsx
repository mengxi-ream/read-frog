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

export function SplitTranslatorShortcut() {
  const t = i18n.t as (key: string) => string
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
      toast.error(t("options.translation.splitTranslatorShortcut.openFailed"))
    })
  }

  const displayShortcut = shortcut === null
    ? ""
    : shortcut
      ? formatPageTranslationShortcut(shortcut)
      : t("options.translation.splitTranslatorShortcut.unset")

  return (
    <ConfigCard
      id="split-translator-shortcut"
      title={t("options.translation.splitTranslatorShortcut.title")}
      description={t("options.translation.splitTranslatorShortcut.description")}
    >
      <div className="flex max-w-sm flex-col gap-3">
        <Input
          aria-label={t("options.translation.splitTranslatorShortcut.title")}
          readOnly
          value={displayShortcut}
        />
        <Button type="button" variant="outline" onClick={handleOpenShortcutSettings}>
          {t("options.translation.splitTranslatorShortcut.openSettings")}
        </Button>
      </div>
    </ConfigCard>
  )
}
