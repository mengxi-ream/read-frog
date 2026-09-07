import { useAtom } from "jotai"
import { Input } from "@/components/ui/base-ui/input"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY } from "@/utils/constants/translate"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../components/config-item"
import { ShortcutConfigItem } from "./shortcut-config-item"

export function PageTranslationShortcut() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.pageTranslation)
  const shortcut = translateConfig.page.shortcut ?? DEFAULT_AUTO_TRANSLATE_SHORTCUT_KEY

  if (import.meta.env.FIREFOX) {
    return (
      <ConfigItem
        id="page-translation-shortcut"
        title={i18n.t("options.shortcuts.pageTranslation.title")}
        description={i18n.t("options.shortcuts.pageTranslation.description")}
      >
        <Input
          disabled
          placeholder={i18n.t("options.shortcuts.pageTranslation.managedByBrowser")}
          aria-label={i18n.t("options.shortcuts.pageTranslation.title")}
          className="w-44"
        />
      </ConfigItem>
    )
  }

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
