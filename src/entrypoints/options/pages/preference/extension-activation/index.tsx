import { i18n } from "@/utils/i18n"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { ConfigSection } from "../../../components/config-section"

/**
 * Where Read Frog is allowed to run. The mode and the site list it reads only mean anything
 * together, and that list grows without limit, so the section points at the page holding both.
 */
export function ExtensionActivationSection() {
  return (
    <ConfigSection title={i18n.t("options.preference.extensionActivation.title")}>
      <ConfigNavItem
        to="/preference/extension-activation"
        title={i18n.t("options.preference.extensionActivation.manageSites")}
        description={i18n.t("options.preference.extensionActivation.description")}
      />
    </ConfigSection>
  )
}
