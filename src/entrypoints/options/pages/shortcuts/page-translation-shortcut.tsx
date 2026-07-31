import { useAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY } from "@/utils/constants/translate"
import { i18n } from "@/utils/i18n"
import { ShortcutConfigItem } from "./shortcut-config-item"

export function PageTranslationShortcut() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const shortcut = translateConfig.page.shortcut ?? DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY

  return (
    <ShortcutConfigItem
      id="page-translation-shortcut"
      title={i18n.t("options.shortcuts.pageTranslation.title")}
      description={i18n.t("options.shortcuts.pageTranslation.description")}
      shortcut={shortcut}
      onChange={(nextShortcut) => {
        void setTranslateConfig({
          ...translateConfig,
          page: {
            ...translateConfig.page,
            shortcut: nextShortcut,
          },
        })
      }}
    />
  )
}
