import { i18n } from "@/utils/i18n"
import { ConfigSection } from "../../../components/config-section"
import { AutoTranslateLanguagesItem } from "./auto-translate-languages-item"
import { AutoTranslateWebsiteItem } from "./auto-translate-website-item"
import { NeverAutoTranslateWebsiteItem } from "./never-auto-translate-website-item"
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
      <AutoTranslateWebsiteItem />
      <NeverAutoTranslateWebsiteItem />
      <AutoTranslateLanguagesItem />
      <SkipLanguagesItem />
      <SmallParagraphFilterItem />
    </ConfigSection>
  )
}
