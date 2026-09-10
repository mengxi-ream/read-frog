import { i18n } from "@/utils/i18n"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { ConfigSection } from "../../../components/config-section"
import { GlossaryEnableItem } from "./enable-item"

export function GlossarySection() {
  return (
    <ConfigSection id="glossary" title={i18n.t("options.advanced.glossary.title")}>
      <GlossaryEnableItem />

      <ConfigNavItem
        to="/advanced/glossary"
        title={i18n.t("options.advanced.glossary.terms.title")}
        description={i18n.t("options.advanced.glossary.terms.description")}
      />
    </ConfigSection>
  )
}
