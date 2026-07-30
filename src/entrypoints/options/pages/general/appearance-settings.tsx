import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"
import { ThemeModeSelect } from "../preference/appearance-and-language/theme-mode-select"

export default function AppearanceSettings() {
  return (
    <ConfigCard
      id="appearance"
      title={i18n.t("options.general.appearance.title")}
      description={i18n.t("options.general.appearance.theme")}
    >
      <div className="flex w-full justify-start md:justify-end">
        <ThemeModeSelect className="w-full" />
      </div>
    </ConfigCard>
  )
}
