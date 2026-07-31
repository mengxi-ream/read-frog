import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"

export function BetaExperienceItem() {
  const [betaExperience, setBetaExperience] = useAtom(configFieldsAtomMap.betaExperience)

  return (
    <ConfigItem
      id="beta-experience"
      title={i18n.t("options.preference.userExperience.beta.title")}
      description={i18n.t("options.preference.userExperience.beta.description")}
    >
      <Switch
        checked={betaExperience.enabled}
        onCheckedChange={(checked) => {
          void setBetaExperience({ enabled: checked })
        }}
      />
    </ConfigItem>
  )
}
