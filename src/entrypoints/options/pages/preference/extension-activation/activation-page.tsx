import { useAtom } from "jotai"
import { Label } from "@/components/ui/base-ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/base-ui/radio-group"
import { usePatternList } from "@/hooks/use-pattern-list"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../components/config-detail-section"
import { ConfigItem } from "../../../components/config-item"
import { PageLayout } from "../../../components/page-layout"
import { PatternsTable } from "../../../components/patterns-table"

/**
 * Drilled into from the Preference page: the mode Read Frog activates by, and the site list that
 * mode reads. The list grows without limit and each row carries a delete button, so it has the
 * room here to run its full length instead of scrolling inside a settings row.
 */
export function ExtensionActivationPage() {
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
    <PageLayout
      title={i18n.t("options.preference.title")}
      description={i18n.t("options.preference.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/preference"
        title={
          <span id="extension-activation">
            {i18n.t("options.preference.extensionActivation.title")}
          </span>
        }
      >
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
            rowsClassName="max-h-none"
          />
        </ConfigItem>
      </ConfigDetailSection>
    </PageLayout>
  )
}
