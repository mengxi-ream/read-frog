import { i18n } from "#imports"
import { useAtom } from "jotai"
import { ShortcutKeyRecorder } from "@/components/shortcut-key-recorder"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY } from "@/utils/constants/translate"
import { ConfigCard } from "../../components/config-card"

export function PageTranslationShortcut() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const shortcut = translateConfig.page.shortcut ?? DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY

  const updateShortcut = (shortcut: string[]) => {
    void setTranslateConfig({
      ...translateConfig,
      page: {
        ...translateConfig.page,
        shortcut,
      },
    })
  }

  return (
    <ConfigCard title={i18n.t("options.translation.pageTranslationShortcut.title")} description={i18n.t("options.translation.pageTranslationShortcut.description")}>
      <ShortcutKeyRecorder shortcutKey={shortcut} onChange={updateShortcut} />
    </ConfigCard>
  )
}
