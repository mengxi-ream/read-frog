import type {
  HostedAiFeature,
  HostedAiOneTimeCreditStatus,
  HostedAiRecurringCreditStatus,
} from "@/utils/hosted-ai/types"
import { Icon } from "@iconify/react"
import { useHostedAiStatus } from "@/components/llm-providers/use-hosted-ai-status"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { formatHostedAiResetAtLocal, getHostedAiPools } from "@/utils/hosted-ai/status"
import { i18n } from "@/utils/i18n"
import { UsageGroup, UsageNotice, UsagePoolRow, UsagePoolRowSkeleton } from "../usage-group"

const FEATURE_LABEL_I18N_KEYS = {
  pageTranslation: "options.apiProviders.builtInAiUsage.features.pageTranslation",
  customAction: "options.apiProviders.builtInAiUsage.features.customAction",
  noteSuggestion: "options.apiProviders.builtInAiUsage.features.noteSuggestion",
  selectionTranslation: "options.apiProviders.builtInAiUsage.features.selectionTranslation",
  videoSubtitles: "options.apiProviders.builtInAiUsage.features.videoSubtitles",
  inputTranslation: "options.apiProviders.builtInAiUsage.features.inputTranslation",
  languageDetection: "options.apiProviders.builtInAiUsage.features.languageDetection",
  pdfTranslation: "options.apiProviders.builtInAiUsage.features.pdfTranslation",
} as const satisfies Record<HostedAiFeature, string>

const PERIOD_LABEL_I18N_KEYS = {
  daily: "options.apiProviders.builtInAiUsage.daily",
  weekly: "options.apiProviders.builtInAiUsage.weekly",
} as const satisfies Record<HostedAiRecurringCreditStatus["periodKind"], string>

function getRemainingPercent(usedPercent: number): number {
  return Math.round(Math.max(0, Math.min(100, 100 - usedPercent)))
}

/**
 * One bar per pool, recurring or one-time. `kindLabel` names the pool and
 * `timeLabel` says when it resets or ends; the label lists the features the
 * pool pays for in a tooltip.
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
    <UsagePoolRow
      value={remainingPercent}
      remainingText={i18n.t("options.apiProviders.builtInAiUsage.remaining", [remainingPercent])}
      label={
        <>
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
        </>
      }
      meta={kindLabel}
      note={timeLabel}
    />
  )
}

function RecurringCreditUsage({ credit }: { credit: HostedAiRecurringCreditStatus }) {
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

/** A one-time pool never resets, so it shows when it expires instead. */
function OneTimeCreditUsage({ credit }: { credit: HostedAiOneTimeCreditStatus }) {
  const formattedExpiresAt = formatHostedAiResetAtLocal(credit.expiresAt)
  return (
    <PoolUsage
      usedPercent={credit.usedPercent}
      features={credit.features}
      kindLabel={i18n.t("options.apiProviders.builtInAiUsage.oneTime")}
      timeLabel={
        formattedExpiresAt
          ? i18n.t("options.apiProviders.builtInAiUsage.expiresAt", [formattedExpiresAt])
          : null
      }
    />
  )
}

/**
 * The Built-in AI pools, in the order the server draws on them: recurring
 * pools, then one-time ones. Guests are told to log in rather than shown their
 * pool — all a guest holds is an ephemeral IP-keyed trial, not worth a bar.
 */
export function BuiltInAiUsage() {
  const { status, isSignedIn, isPending, isError } = useHostedAiStatus()
  const pools = getHostedAiPools(status)

  function renderContent() {
    if (isPending) {
      return <UsagePoolRowSkeleton />
    }
    if (!isSignedIn) {
      return <UsageNotice>{i18n.t("options.usage.logInToView")}</UsageNotice>
    }
    if (isError || pools.length === 0) {
      return <UsageNotice>{i18n.t("hostedAi.availability.serviceUnavailable")}</UsageNotice>
    }
    return pools.map((pool) =>
      pool.periodKind === "once" ? (
        <OneTimeCreditUsage
          key={`once-${pool.expiresAt}-${pool.features.join("-")}`}
          credit={pool}
        />
      ) : (
        <RecurringCreditUsage key={`${pool.periodKind}-${pool.features.join("-")}`} credit={pool} />
      ),
    )
  }

  return (
    <UsageGroup id="built-in-ai-usage" title={i18n.t("options.apiProviders.builtInAiUsage.title")}>
      {renderContent()}
    </UsageGroup>
  )
}
