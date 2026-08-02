import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../components/config-detail-section"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { PageLayout } from "../../../components/page-layout"
import { AutoTranslateLanguagesItem } from "./auto-translate-languages-item"
import { SkipLanguagesItem } from "./skip-languages-item"
import { SmallParagraphFilterItem } from "./small-paragraph-filter-item"

/**
 * Drilled into from the Translation page: every rule for what translates without being asked
 * and what never does — by site, by language, or by how little text a paragraph holds. Three
 * of the rows are lists long enough to earn pages of their own, drilled into from here.
 */
export function TranslationControlPage() {
  return (
    <PageLayout
      title={i18n.t("options.translation.title")}
      description={i18n.t("options.translation.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/page-translation"
        title={
          <span id="translation-control">
            {i18n.t("options.translation.translationControl.title")}
          </span>
        }
      >
        <ConfigNavItem
          to="/page-translation/translation-control/auto-translate-websites"
          title={i18n.t("options.translation.translationControl.autoTranslateWebsite.title")}
          description={i18n.t(
            "options.translation.translationControl.autoTranslateWebsite.description",
          )}
        />
        <ConfigNavItem
          to="/page-translation/translation-control/never-auto-translate-websites"
          title={i18n.t("options.translation.translationControl.neverAutoTranslateWebsite.title")}
          description={i18n.t(
            "options.translation.translationControl.neverAutoTranslateWebsite.description",
          )}
        />
        <AutoTranslateLanguagesItem />
        <SkipLanguagesItem />
        <SmallParagraphFilterItem />
        <ConfigNavItem
          to="/page-translation/translation-control/site-rules"
          title={i18n.t("options.siteRules.title")}
          description={i18n.t("options.siteRules.description")}
        />
      </ConfigDetailSection>
    </PageLayout>
  )
}
