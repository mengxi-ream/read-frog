import { i18n } from "@/utils/i18n"
import { ConfigSection } from "../../../components/config-section"
import { AnalyticsItem } from "./analytics"
import { BetaExperienceItem } from "./beta-experience"

export function UserExperienceSection() {
  return (
    <ConfigSection title={i18n.t("options.preference.userExperience.title")}>
      <BetaExperienceItem />
      <AnalyticsItem />
    </ConfigSection>
  )
}
