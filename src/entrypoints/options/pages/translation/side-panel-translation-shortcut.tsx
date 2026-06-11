import { useAtom } from "jotai"
import { i18n } from "#imports"
import { ShortcutKeyRecorder } from "@/components/shortcut-key-recorder"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_SIDE_PANEL_TRANSLATION_SHORTCUT_KEY } from "@/utils/constants/translate"
import { ConfigCard } from "../../components/config-card"

export function SidePanelTranslationShortcut() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const shortcut = translateConfig.page.sidePanelShortcut ?? DEFAULT_SIDE_PANEL_TRANSLATION_SHORTCUT_KEY

  const updateShortcut = (sidePanelShortcut: string) => {
    void setTranslateConfig({
      ...translateConfig,
      page: {
        ...translateConfig.page,
        sidePanelShortcut,
      },
    })
  }

  return (
    <ConfigCard id="side-panel-translation-shortcut" title={i18n.t("options.translation.sidePanelTranslationShortcut.title")} description={i18n.t("options.translation.sidePanelTranslationShortcut.description")}>
      <ShortcutKeyRecorder shortcutKey={shortcut} onChange={updateShortcut} />
    </ConfigCard>
  )
}
