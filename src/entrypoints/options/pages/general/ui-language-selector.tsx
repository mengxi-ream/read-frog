import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"
import { UiLanguageSelect } from "../preference/appearance-and-language/ui-language-select"

export default function UiLanguageSelector() {
  return (
    <ConfigCard
      id="interface-language"
      title={i18n.t("options.general.interfaceLanguage.title")}
      description={i18n.t("options.general.interfaceLanguage.description")}
    >
      <div className="flex w-full justify-start md:justify-end">
        <UiLanguageSelect className="w-full" />
      </div>
    </ConfigCard>
  )
}
