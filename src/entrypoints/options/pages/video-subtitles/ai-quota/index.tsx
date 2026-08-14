import type { VideoTranscriptUsage, VideoTranscriptUsagePool } from "@read-frog/api-contract"
import type { ReactNode } from "react"
import { ORPCError } from "@orpc/client"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/base-ui/button"
import { Progress, ProgressLabel } from "@/components/ui/base-ui/progress"
import { Skeleton } from "@/components/ui/base-ui/skeleton"
import { openLogIn } from "@/components/user-account-menu/shared"
import { authClient } from "@/utils/auth/auth-client"
import { i18n } from "@/utils/i18n"
import { orpc } from "@/utils/orpc/client"
import { cn } from "@/utils/styles/utils"
import {
  formatQuotaDate,
  launchBonusCutoffLabel,
  pricingUrl,
} from "@/utils/subtitles/ai/entitlement"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"

const NEAR_LIMIT_RATIO = 0.9

function errorStatus(error: unknown): number | null {
  return error instanceof ORPCError ? error.status : null
}

/**
 * How much AI transcription the account has spent. One progress bar per quota
 * pool: the monthly subscription pool (labeled with its reset date) and, for
 * launch-window subscribers, the one-time gift (labeled with its expiry).
 * Usage is fetched only when this section mounts — never on page load in a
 * content script — mirroring how the Built-in AI usage panel reads its status.
 */
export function AiQuotaSection() {
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const isSignedIn = !!session?.user

  const usageQuery = useQuery(
    orpc.videoTranscript.getUsage.queryOptions({
      enabled: isSignedIn,
      retry: false,
      staleTime: 60_000,
      meta: {
        suppressToast: true,
      },
    }),
  )

  function renderContent() {
    if (isSessionPending || (isSignedIn && usageQuery.isPending)) {
      return <QuotaSkeleton />
    }

    const status = errorStatus(usageQuery.error)

    // Not signed in (or an expired session surfaced as 401) -> prompt to log in.
    if (!isSignedIn || status === 401) {
      return <QuotaLoginGuide />
    }

    // A pre-launch server still gates getUsage behind the beta 403; the new
    // server answers free accounts with plan "free" instead. Both mean the
    // same thing now: this account needs a subscription. Drop this branch once
    // the server retires VIDEO_TRANSCRIPTION_BETA_RESTRICTED for good.
    if (status === 403) {
      return <QuotaUpgradeGuide />
    }

    if (usageQuery.isError || !usageQuery.data) {
      return <QuotaNotice>{i18n.t("options.videoSubtitles.aiQuota.loadError")}</QuotaNotice>
    }

    if (usageQuery.data.plan === "free") {
      return <QuotaUpgradeGuide />
    }

    return <QuotaUsage usage={usageQuery.data} />
  }

  return (
    <ConfigSection id="subtitles-ai-quota" title={i18n.t("options.videoSubtitles.aiQuota.title")}>
      <ConfigItem
        orientation="vertical"
        description={i18n.t("options.videoSubtitles.aiQuota.description")}
      >
        {renderContent()}
      </ConfigItem>
    </ConfigSection>
  )
}

function QuotaSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-1.5 w-full" />
    </div>
  )
}

/**
 * Secondary copy in this slot sits directly under the ConfigItem description
 * and must not out-size it, so it shares that 13px scale rather than the
 * text-sm the Built-in AI panel can afford — that panel hangs straight off its
 * ConfigSection, with no description above it to be measured against.
 */
function QuotaNotice({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-[18px] text-muted-foreground">{children}</p>
}

/**
 * The launch offer, sitting under the wall it is trying to overturn. Renders
 * nothing once the window closes: the server stops issuing the grant at the
 * cutoff, so an ungated banner would age into a promise we no longer keep.
 */
function LaunchBonusPromo() {
  const cutoff = launchBonusCutoffLabel()
  if (!cutoff) {
    return null
  }
  return (
    <p className="text-[13px] leading-[18px] text-blue-600 dark:text-blue-400">
      {i18n.t("options.videoSubtitles.aiQuota.launchBonusPromo", [cutoff])}
    </p>
  )
}

function QuotaLoginGuide() {
  return (
    <div className="flex flex-col items-start gap-2.5">
      <QuotaNotice>{i18n.t("options.videoSubtitles.aiQuota.loginRequired")}</QuotaNotice>
      <Button variant="outline" size="sm" onClick={openLogIn}>
        {i18n.t("account.login")}
      </Button>
      <LaunchBonusPromo />
    </div>
  )
}

function QuotaUpgradeGuide() {
  return (
    <div className="flex flex-col items-start gap-2.5">
      <QuotaNotice>{i18n.t("options.videoSubtitles.aiQuota.upgradeRequired")}</QuotaNotice>
      {/* Unlike the player, this surface never navigates on its own — opening a
          tab just for landing on the settings page would be hostile. */}
      <Button variant="outline" size="sm" onClick={() => window.open(pricingUrl(), "_blank")}>
        {i18n.t("action.upgrade")}
      </Button>
      <LaunchBonusPromo />
    </div>
  )
}

function QuotaUsage({ usage }: { usage: VideoTranscriptUsage }) {
  // A server that predates pools reports totals only; render them as one bar.
  const pools: VideoTranscriptUsagePool[] = usage.pools?.length
    ? usage.pools
    : [
        {
          id: "subscription",
          usedMinutes: usage.usedMinutes,
          limitMinutes: usage.limitMinutes,
          remainingMinutes: usage.remainingMinutes,
          resetAt: null,
          expiresAt: null,
        },
      ]

  return (
    <div className="flex flex-col gap-4">
      {pools.map((pool) => (
        <QuotaPoolUsage key={pool.id} pool={pool} />
      ))}
    </div>
  )
}

/**
 * Typography and rhythm mirror the Built-in AI usage panel: the pool name and
 * the remaining count share the Progress header row, the track fill is what is
 * LEFT (a fresh pool reads as a full bar), and the metadata line below carries
 * the spent minutes and the pool's one meaningful date at text-xs.
 */
function QuotaPoolUsage({ pool }: { pool: VideoTranscriptUsagePool }) {
  const { usedMinutes, limitMinutes, remainingMinutes } = pool
  const remainingRatio = limitMinutes > 0 ? remainingMinutes / limitMinutes : 0
  const remainingPercent = Math.min(100, Math.max(0, remainingRatio * 100))
  const isNearLimit = remainingRatio <= 1 - NEAR_LIMIT_RATIO

  const label =
    pool.id === "launchBonus"
      ? i18n.t("options.videoSubtitles.aiQuota.pools.launchBonus")
      : i18n.t("options.videoSubtitles.aiQuota.pools.subscription")
  const remainingText = i18n.t("options.videoSubtitles.aiQuota.remainingOf", [
    remainingMinutes,
    limitMinutes,
  ])
  // The monthly pool resets; the one-time gift only expires. Show whichever
  // date the pool actually has.
  const resetAt = formatQuotaDate(pool.resetAt)
  const expiresAt = formatQuotaDate(pool.expiresAt)
  const dateNote = resetAt
    ? i18n.t("options.videoSubtitles.aiQuota.resetsOn", [resetAt])
    : expiresAt
      ? i18n.t("options.videoSubtitles.aiQuota.expiresOn", [expiresAt])
      : null

  return (
    <div className="flex flex-col gap-1.5">
      <Progress
        value={remainingPercent}
        className={cn(
          "gap-x-3 gap-y-1.5",
          isNearLimit && "[&_[data-slot=progress-indicator]]:bg-destructive",
        )}
        // Announce "X of Y min left", not a bare percentage that reads as consumption.
        getAriaValueText={() => remainingText}
      >
        <ProgressLabel>{label}</ProgressLabel>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{remainingText}</span>
      </Progress>
      <div className="flex flex-wrap items-center justify-between gap-x-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {i18n.t("options.videoSubtitles.aiQuota.used", [usedMinutes])}
        </span>
        {dateNote && <span>{dateNote}</span>}
      </div>
    </div>
  )
}
