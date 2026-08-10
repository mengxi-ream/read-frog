import type { HostedAiCreditStatus, HostedAiFeature } from "@/utils/hosted-ai/types"
import { Icon } from "@iconify/react"
import { useHostedAiStatus } from "@/components/llm-providers/use-hosted-ai-status"
import { Progress, ProgressLabel } from "@/components/ui/base-ui/progress"
import { Skeleton } from "@/components/ui/base-ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { formatHostedAiResetAtLocal } from "@/utils/hosted-ai/status"
import { i18n } from "@/utils/i18n"
import { ConfigSection } from "../../../components/config-section"

const FEATURE_LABEL_I18N_KEYS = {
  pageTranslation: "options.apiProviders.builtInAiUsage.features.pageTranslation",
  customAction: "options.apiProviders.builtInAiUsage.features.customAction",
  noteSuggestion: "options.apiProviders.builtInAiUsage.features.noteSuggestion",
} as const satisfies Record<HostedAiFeature, string>

const PERIOD_LABEL_I18N_KEYS = {
  daily: "options.apiProviders.builtInAiUsage.daily",
  weekly: "options.apiProviders.builtInAiUsage.weekly",
} as const satisfies Record<HostedAiCreditStatus["periodKind"], string>

function getRemainingPercent(credit: HostedAiCreditStatus): number {
  return Math.round(Math.max(0, Math.min(100, 100 - credit.usedPercent)))
}

/**
 * One bar per credit pool. The track is the whole quota and the fill is what is
 * left, growing from the left — so a fresh pool reads as a full bar.
 */
function CreditPoolUsage({ credit }: { credit: HostedAiCreditStatus }) {
  const remainingPercent = getRemainingPercent(credit)
  const formattedResetAt = credit.resetAt ? formatHostedAiResetAtLocal(credit.resetAt) : null

  return (
    <div className="flex flex-col gap-1.5">
      <Progress
        value={remainingPercent}
        className="gap-x-3 gap-y-1.5"
        // Announce "62% left", not a bare "62%" that reads as consumption.
        getAriaValueText={(_, value) =>
          i18n.t("options.apiProviders.builtInAiUsage.remaining", [value ?? remainingPercent])
        }
      >
        <ProgressLabel className="flex items-center gap-1.5 text-sm font-medium">
          {i18n.t("options.apiProviders.builtInAiUsage.supportedFeatures", [
            credit.features.length,
          ])}
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="inline-flex cursor-default items-center text-muted-foreground" />
              }
            >
              <Icon icon="tabler:list" className="size-3.5" />
            </TooltipTrigger>
            <TooltipContent>
              <ul className="list-inside list-disc marker:text-green-500">
                {credit.features.map((feature) => (
                  <li key={feature}>{i18n.t(FEATURE_LABEL_I18N_KEYS[feature])}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        </ProgressLabel>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {i18n.t("options.apiProviders.builtInAiUsage.remaining", [remainingPercent])}
        </span>
      </Progress>
      <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted-foreground">
        <span>{i18n.t(PERIOD_LABEL_I18N_KEYS[credit.periodKind])}</span>
        {formattedResetAt && (
          <span>{i18n.t("options.apiProviders.builtInAiUsage.resetsAt", [formattedResetAt])}</span>
        )}
      </div>
    </div>
  )
}

export function BuiltInAiUsageConfig() {
  const { status, isSignedIn, isPending, isError } = useHostedAiStatus()
  const credits = status?.credits ?? []

  // Guests only hold an ephemeral IP-keyed trial pool — not worth a section.
  if (!isSignedIn) {
    return null
  }

  return (
    <ConfigSection
      id="built-in-ai-usage"
      title={i18n.t("options.apiProviders.builtInAiUsage.title")}
    >
      {isPending ? (
        <Skeleton className="h-13 w-full" />
      ) : isError || credits.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {i18n.t("hostedAi.availability.serviceUnavailable")}
        </p>
      ) : (
        credits.map((credit) => (
          <CreditPoolUsage
            key={`${credit.periodKind}-${credit.features.join("-")}`}
            credit={credit}
          />
        ))
      )}
    </ConfigSection>
  )
}
