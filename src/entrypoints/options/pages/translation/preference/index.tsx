import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { ShortcutLink } from "../../../components/shortcut-link"
import { TranslateRangeSelect } from "./translate-range-select"
import { TranslationModeSelect } from "./translation-mode-select"

/** How a page gets translated once translation starts — what is shown, and how much of it. */
export function PreferenceSection() {
  return (
    <ConfigSection title={i18n.t("options.translation.preference.title")}>
      <ConfigItem
        id="translation-mode"
        title={i18n.t("options.translation.translationMode.title")}
        description={
          <>
            {i18n.t("options.translation.translationMode.description")}
            <ShortcutLink sectionId="translation-mode-shortcut" />
          </>
        }
      >
        <TranslationModeSelect />
      </ConfigItem>
      <ConfigItem
        id="translate-range"
        title={i18n.t("options.translation.translateRange.title")}
        description={i18n.t("options.translation.translateRange.description")}
      >
        <TranslateRangeSelect />
      </ConfigItem>
    </ConfigSection>
  )
}
