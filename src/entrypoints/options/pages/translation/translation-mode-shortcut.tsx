import { useAtom } from "jotai"
import { i18n } from "#imports"
import { ShortcutKeyRecorder } from "@/components/shortcut-key-recorder"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"

export function TranslationModeShortcut() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const shortcut = translateConfig.modeShortcut ?? ""

  const updateShortcut = (shortcut: string) => {
    void setTranslateConfig({
      ...translateConfig,
      modeShortcut: shortcut,
    })
  }

  return (
    <ConfigCard id="translation-mode-shortcut" title={i18n.t("options.translation.translationModeShortcut.title")} description={i18n.t("options.translation.translationModeShortcut.description")}>
      <ShortcutKeyRecorder shortcutKey={shortcut} onChange={updateShortcut} />
    </ConfigCard>
  )
}
