import { i18n } from "@/utils/i18n"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { ConfigSection } from "../../../components/config-section"
import { AutoTranslateLanguagesItem } from "./auto-translate-languages-item"
import { SkipLanguagesItem } from "./skip-languages-item"
import { SmallParagraphFilterItem } from "./small-paragraph-filter-item"

/**
 * What gets translated without being asked, and what never does. Every row here answers the
 * same question — by site, by language, or by how little text a paragraph holds.
 */
export function TranslateControlSection() {
  return (
    <ConfigSection
      id="translate-control"
      title={i18n.t("options.translation.translateControl.title")}
    >
      <ConfigNavItem
        to="/page-translation/auto-translate-websites"
        title={i18n.t("options.translation.autoTranslateWebsite.title")}
        description={i18n.t("options.translation.autoTranslateWebsite.description")}
      />
      <ConfigNavItem
        to="/page-translation/never-auto-translate-websites"
        title={i18n.t("options.translation.neverAutoTranslateWebsite.title")}
        description={i18n.t("options.translation.neverAutoTranslateWebsite.description")}
      />
      <AutoTranslateLanguagesItem />
      <SkipLanguagesItem />
      <SmallParagraphFilterItem />
    </ConfigSection>
  )
}
