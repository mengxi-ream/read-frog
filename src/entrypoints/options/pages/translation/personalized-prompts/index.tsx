import { i18n } from "@/utils/i18n"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { ConfigSection } from "../../../components/config-section"

/**
 * Prompts are written, imported and exported, not set — a grid of cards with its own toolbar
 * has nothing to do in a settings row, so the section only points at the page that holds it.
 */
export function PersonalizedPromptsSection() {
  return (
    <ConfigSection title={i18n.t("options.translation.personalizedPrompts.title")}>
      <ConfigNavItem
        to="/page-translation/prompts"
        title={i18n.t("options.translation.personalizedPrompts.managePrompts")}
        description={i18n.t("options.translation.personalizedPrompts.description")}
      />
    </ConfigSection>
  )
}
