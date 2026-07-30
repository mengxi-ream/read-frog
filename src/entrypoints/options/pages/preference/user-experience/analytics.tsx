import { useAtom } from "jotai"
import { HelpTooltip } from "@/components/help-tooltip"
import { Switch } from "@/components/ui/base-ui/switch"
import { analyticsEnabledAtom } from "@/utils/atoms/analytics"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"

export function AnalyticsItem() {
  const [analyticsEnabled, setAnalyticsEnabled] = useAtom(analyticsEnabledAtom)

  return (
    <ConfigItem
      id="analytics"
      title={
        <span className="flex items-center gap-1.5">
          {i18n.t("options.config.analytics.title")}
          {/* The description stays short, so the tooltip carries what is actually collected. */}
          <HelpTooltip contentClassName="max-w-80">
            {i18n.t("options.config.analytics.tooltip")}
          </HelpTooltip>
        </span>
      }
      description={i18n.t("options.config.analytics.description")}
    >
      <Switch
        checked={analyticsEnabled}
        onCheckedChange={(checked) => {
          void setAnalyticsEnabled(checked)
        }}
      />
    </ConfigItem>
  )
}
