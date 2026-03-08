import { i18n } from "#imports"
import { useAtom } from "jotai"
import { Label } from "@/components/ui/base-ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/base-ui/radio-group"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"
import { PatternsTable } from "../../components/patterns-table"

export default function SiteControlMode() {
  const [siteControl, setSiteControl] = useAtom(configFieldsAtomMap.siteControl)

  const patternsKey = siteControl.mode === "blacklist"
    ? "blacklistPatterns" as const
    : "whitelistPatterns" as const
  const patterns = siteControl[patternsKey] ?? []

  const addPattern = async (pattern: string) => {
    const cleanedPattern = pattern.trim()
    if (!cleanedPattern || patterns.includes(cleanedPattern))
      return

    await setSiteControl({
      ...siteControl,
      [patternsKey]: [...patterns, cleanedPattern],
    })
  }

  const removePattern = async (pattern: string) => {
    await setSiteControl({
      ...siteControl,
      [patternsKey]: patterns.filter(p => p !== pattern),
    })
  }

  return (
    <ConfigCard
      id="site-control-mode"
      title={i18n.t("options.siteControl.mode.title")}
      description={i18n.t("options.siteControl.mode.description")}
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
            {i18n.t("options.siteControl.mode.blacklist")}
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="whitelist" id="mode-whitelist" />
          <Label htmlFor="mode-whitelist" className="cursor-pointer">
            {i18n.t("options.siteControl.mode.whitelist")}
          </Label>
        </div>
      </RadioGroup>
      <PatternsTable
        patterns={patterns}
        onAddPattern={addPattern}
        onRemovePattern={removePattern}
        placeholderText={i18n.t("options.siteControl.patterns.enterUrlPattern")}
        tableHeaderText={i18n.t("options.siteControl.patterns.urlPattern")}
        className="mt-6"
      />
    </ConfigCard>
  )
}
