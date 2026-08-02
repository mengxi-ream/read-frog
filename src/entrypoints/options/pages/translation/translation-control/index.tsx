import { i18n } from "@/utils/i18n"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { ConfigSection } from "../../../components/config-section"

/**
 * What gets translated without being asked, and what never does. Six rows answering that one
 * question — three of which open pages of their own — is a page's worth, not a section's, so
 * the section only points at it.
 */
export function TranslationControlSection() {
  return (
    <ConfigSection title={i18n.t("options.translation.translationControl.title")}>
      <ConfigNavItem
        to="/page-translation/translation-control"
        title={i18n.t("options.translation.translationControl.manageControls")}
        description={i18n.t("options.translation.translationControl.description")}
      />
    </ConfigSection>
  )
}
