import { i18n } from "#imports"
import { useAtom } from "jotai"
import { ShortcutKeyRecorder } from "@/components/shortcut-key-recorder"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_SPLIT_TRANSLATOR_SHORTCUT_KEY } from "@/utils/constants/translate"
import { ConfigCard } from "../../components/config-card"

export function SplitTranslatorShortcut() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const shortcut = translateConfig.splitTranslator.shortcut ?? DEFAULT_SPLIT_TRANSLATOR_SHORTCUT_KEY

  const updateShortcut = (shortcut: string) => {
    void setTranslateConfig({
      ...translateConfig,
      splitTranslator: {
        ...translateConfig.splitTranslator,
        shortcut,
      },
    })
  }

  return (
    <ConfigCard
      id="split-translator-shortcut"
      title={i18n.t("options.translation.splitTranslatorShortcut.title")}
      description={i18n.t("options.translation.splitTranslatorShortcut.description")}
    >
      <ShortcutKeyRecorder shortcutKey={shortcut} onChange={updateShortcut} />
    </ConfigCard>
  )
}
