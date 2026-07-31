import { useAtom } from "jotai"
import { Label } from "@/components/ui/base-ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/base-ui/radio-group"
import { usePatternList } from "@/hooks/use-pattern-list"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { PatternsTable } from "../../../components/patterns-table"

export function ExtensionActivationSection() {
  const [siteControl, setSiteControl] = useAtom(configFieldsAtomMap.siteControl)

  const patternsKey =
    siteControl.mode === "blacklist"
      ? ("blacklistPatterns" as const)
      : ("whitelistPatterns" as const)
  const patterns = siteControl[patternsKey] ?? []

  const { addPattern, removePattern } = usePatternList(patterns, (nextPatterns) => {
    void setSiteControl({ ...siteControl, [patternsKey]: nextPatterns })
  })

  return (
    <ConfigSection title={i18n.t("options.preference.extensionActivation.title")}>
      <ConfigItem
        id="site-control-mode"
        orientation="vertical"
        title={i18n.t("options.preference.extensionActivation.mode.title")}
        description={i18n.t("options.preference.extensionActivation.mode.description")}
      >
        <RadioGroup
          value={siteControl.mode}
          onValueChange={async (value) => {
            await setSiteControl({
              ...siteControl,
              mode: value,
            })
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="blacklist" id="mode-blacklist" />
            <Label htmlFor="mode-blacklist" className="cursor-pointer">
              {i18n.t("options.preference.extensionActivation.mode.blacklist")}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="whitelist" id="mode-whitelist" />
            <Label htmlFor="mode-whitelist" className="cursor-pointer">
              {i18n.t("options.preference.extensionActivation.mode.whitelist")}
            </Label>
          </div>
        </RadioGroup>
        <PatternsTable
          patterns={patterns}
          onAddPattern={addPattern}
          onRemovePattern={removePattern}
          placeholderText={i18n.t(
            "options.preference.extensionActivation.patterns.enterUrlPattern",
          )}
          tableHeaderText={i18n.t("options.preference.extensionActivation.patterns.urlPattern")}
          className="mt-6"
        />
      </ConfigItem>
    </ConfigSection>
  )
}
