import type {
  HostedAiCreditGrantStatus,
  HostedAiCreditStatus,
  HostedAiFeature,
} from "@/utils/hosted-ai/types"
import { Icon } from "@iconify/react"
import { useHostedAiStatus } from "@/components/llm-providers/use-hosted-ai-status"
import { Progress, ProgressLabel } from "@/components/ui/base-ui/progress"
import { Skeleton } from "@/components/ui/base-ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { formatHostedAiResetAtLocal, getHostedAiPools } from "@/utils/hosted-ai/status"
import { i18n } from "@/utils/i18n"
import { ConfigSection } from "../../../components/config-section"

const FEATURE_LABEL_I18N_KEYS = {
  pageTranslation: "options.apiProviders.builtInAiUsage.features.pageTranslation",
  customAction: "options.apiProviders.builtInAiUsage.features.customAction",
  noteSuggestion: "options.apiProviders.builtInAiUsage.features.noteSuggestion",
  selectionTranslation: "options.apiProviders.builtInAiUsage.features.selectionTranslation",
  videoSubtitles: "options.apiProviders.builtInAiUsage.features.videoSubtitles",
  inputTranslation: "options.apiProviders.builtInAiUsage.features.inputTranslation",
  languageDetection: "options.apiProviders.builtInAiUsage.features.languageDetection",
} as const satisfies Record<HostedAiFeature, string>

const PERIOD_LABEL_I18N_KEYS = {
  daily: "options.apiProviders.builtInAiUsage.daily",
  weekly: "options.apiProviders.builtInAiUsage.weekly",
} as const satisfies Record<HostedAiCreditStatus["periodKind"], string>

function getRemainingPercent(usedPercent: number): number {
  return Math.round(Math.max(0, Math.min(100, 100 - usedPercent)))
}

/**
 * One bar per pool, plan pool or grant. The track is the whole quota and the
 * fill is what is left, growing from the left — so a fresh pool reads as a full
 * bar. `kindLabel` names the pool and `timeLabel` says when it resets or ends.
 */
function PoolUsage({
  usedPercent,
  features,
  kindLabel,
  timeLabel,
}: {
  usedPercent: number
  features: HostedAiFeature[]
  kindLabel: string
  timeLabel: string | null
}) {
  const remainingPercent = getRemainingPercent(usedPercent)

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
          {i18n.t("options.apiProviders.builtInAiUsage.supportedFeatures", [features.length])}
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
                {features.map((feature) => (
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
        <span>{kindLabel}</span>
        {timeLabel && <span>{timeLabel}</span>}
      </div>
    </div>
  )
}

function CreditPoolUsage({ credit }: { credit: HostedAiCreditStatus }) {
  const formattedResetAt = credit.resetAt ? formatHostedAiResetAtLocal(credit.resetAt) : null
  return (
    <PoolUsage
      usedPercent={credit.usedPercent}
      features={credit.features}
      kindLabel={i18n.t(PERIOD_LABEL_I18N_KEYS[credit.periodKind])}
      timeLabel={
        formattedResetAt
          ? i18n.t("options.apiProviders.builtInAiUsage.resetsAt", [formattedResetAt])
          : null
      }
    />
  )
}

/** A one-time grant: it never resets, so it shows when it expires instead. */
function GrantUsage({ grant }: { grant: HostedAiCreditGrantStatus }) {
  const formattedExpiresAt = formatHostedAiResetAtLocal(grant.expiresAt)
  return (
    <PoolUsage
      usedPercent={grant.usedPercent}
      features={grant.features}
      kindLabel={i18n.t("options.apiProviders.builtInAiUsage.grant")}
      timeLabel={
        formattedExpiresAt
          ? i18n.t("options.apiProviders.builtInAiUsage.expiresAt", [formattedExpiresAt])
          : null
      }
    />
  )
}

export function BuiltInAiUsageConfig() {
  const { status, isSignedIn, isPending, isError } = useHostedAiStatus()
  // In the order the server draws on them: the plan's pools, then grants.
  const pools = getHostedAiPools(status)

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
      ) : isError || pools.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {i18n.t("hostedAi.availability.serviceUnavailable")}
        </p>
      ) : (
        pools.map((pool) =>
          pool.periodKind === "once" ? (
            <GrantUsage key={`once-${pool.expiresAt}-${pool.features.join("-")}`} grant={pool} />
          ) : (
            <CreditPoolUsage key={`${pool.periodKind}-${pool.features.join("-")}`} credit={pool} />
          ),
        )
      )}
    </ConfigSection>
  )
}
