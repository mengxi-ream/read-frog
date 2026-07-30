import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { ThemeModeSelect } from "./theme-mode-select"
import { UiLanguageSelect } from "./ui-language-select"

export function AppearanceAndLanguageSection() {
  return (
    <ConfigSection title={i18n.t("options.preference.appearanceAndLanguage.title")}>
      <ConfigItem
        id="theme"
        title={i18n.t("options.general.appearance.theme")}
        description={i18n.t("options.preference.appearanceAndLanguage.theme.description")}
      >
        <ThemeModeSelect size="sm" />
      </ConfigItem>
      <ConfigItem
        id="interface-language"
        title={i18n.t("options.general.interfaceLanguage.title")}
        description={i18n.t("options.general.interfaceLanguage.description")}
      >
        <UiLanguageSelect size="sm" />
      </ConfigItem>
    </ConfigSection>
  )
}
