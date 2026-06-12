import type { SplitPanelMode } from "@/types/config/translate"
import { useAtom } from "jotai"
import { i18n } from "#imports"
import { Label } from "@/components/ui/base-ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/base-ui/radio-group"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"

export default function SplitPanelModeConfig() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const splitPanelMode = translateConfig.page.splitPanelMode ?? "dom"

  const updateSplitPanelMode = (value: string) => {
    if (value !== "dom" && value !== "sideAPI")
      return

    void setTranslateConfig({
      ...translateConfig,
      page: {
        ...translateConfig.page,
        splitPanelMode: value as SplitPanelMode,
      },
    })
  }

  return (
    <ConfigCard
      id="split-panel-mode"
      title={i18n.t("options.general.splitPanelMode.title")}
      description={i18n.t("options.general.splitPanelMode.description")}
    >
      <RadioGroup
        value={splitPanelMode}
        onValueChange={updateSplitPanelMode}
        className="flex flex-row gap-4"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="dom" id="split-panel-mode-dom" />
          <Label htmlFor="split-panel-mode-dom">{i18n.t("options.general.splitPanelMode.mode.dom")}</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="sideAPI" id="split-panel-mode-side-api" />
          <Label htmlFor="split-panel-mode-side-api">{i18n.t("options.general.splitPanelMode.mode.sideAPI")}</Label>
        </div>
      </RadioGroup>
    </ConfigCard>
  )
}
