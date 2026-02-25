import { i18n } from "#imports"
import { useAtom } from "jotai"
import { Label } from "@/components/ui/base-ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/base-ui/radio-group"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"
import { DisabledPatternsTable } from "../../components/disabled-patterns-table"

export default function SiteControlMode() {
  const [siteControl, setSiteControl] = useAtom(configFieldsAtomMap.siteControl)
  const { patterns = [] } = siteControl

  const addPattern = (pattern: string) => {
    const cleanedPattern = pattern.trim()
    if (!cleanedPattern || patterns.includes(cleanedPattern))
      return

    void setSiteControl({
      ...siteControl,
      patterns: [...patterns, cleanedPattern],
    })
  }

  const removePattern = (pattern: string) => {
    void setSiteControl({
      ...siteControl,
      patterns: patterns.filter(p => p !== pattern),
    })
  }

  return (
    <ConfigCard
      title={i18n.t("options.siteControl.mode.title")}
      description={i18n.t("options.siteControl.mode.description")}
    >
      <RadioGroup
        value={siteControl.mode}
        onValueChange={(value) => {
          void setSiteControl({
            ...siteControl,
            mode: value as "all" | "whitelist",
          })
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="all" id="mode-all" />
          <Label htmlFor="mode-all" className="cursor-pointer">
            {i18n.t("options.siteControl.mode.all")}
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="whitelist" id="mode-whitelist" />
          <Label htmlFor="mode-whitelist" className="cursor-pointer">
            {i18n.t("options.siteControl.mode.whitelist")}
          </Label>
        </div>
      </RadioGroup>
      {siteControl.mode === "whitelist" && (
        <DisabledPatternsTable
          patterns={patterns}
          onAddPattern={addPattern}
          onRemovePattern={removePattern}
          placeholderText={i18n.t("options.siteControl.patterns.enterUrlPattern")}
          tableHeaderText={i18n.t("options.siteControl.patterns.urlPattern")}
          className="mt-6"
        />
      )}
    </ConfigCard>
  )
}
