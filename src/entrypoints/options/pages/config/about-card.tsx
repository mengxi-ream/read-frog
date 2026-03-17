import { i18n } from "#imports"
import { useAtom } from "jotai"
import { HelpTooltip } from "@/components/help-tooltip"
import { Switch } from "@/components/ui/base-ui/switch"
import { analyticsEnabledAtom } from "@/utils/atoms/analytics"
import { ConfigCard } from "../../components/config-card"

export function AboutCard() {
  const [analyticsEnabled, setAnalyticsEnabled] = useAtom(analyticsEnabledAtom)

  return (
    <ConfigCard
      id="about"
      title={i18n.t("options.config.about.title")}
      description={i18n.t("options.config.about.description")}
    >
      <div className="space-y-2">
        <p className="max-w-xl text-sm text-muted-foreground">
          {i18n.t("options.config.about.mission")}
        </p>

        <div className="flex w-full items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {i18n.t("options.config.about.analytics.title")}
            </span>
            <HelpTooltip contentClassName="max-w-80">
              {i18n.t("options.config.about.analytics.tooltip")}
            </HelpTooltip>
          </div>
          <Switch
            checked={analyticsEnabled}
            onCheckedChange={(checked) => {
              void setAnalyticsEnabled(checked)
            }}
          />
        </div>
      </div>
    </ConfigCard>
  )
}
