import type { VideoTranscriptUsage, VideoTranscriptUsagePool } from "@read-frog/api-contract"
import { ORPCError } from "@orpc/client"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { authClient } from "@/utils/auth/auth-client"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { orpc } from "@/utils/orpc/client"
import { formatQuotaDate } from "@/utils/subtitles/ai/entitlement"
import { UsageGroup, UsageNotice, UsagePoolRow, UsagePoolRowSkeleton } from "../usage-group"

const NEAR_LIMIT_RATIO = 0.9

function errorStatus(error: unknown): number | null {
  return error instanceof ORPCError ? error.status : null
}

/**
 * How much AI transcription the account has spent. One progress bar per quota
 * pool: the monthly subscription pool (labeled with its reset date) and, for
 * launch-window subscribers, the one-time gift (labeled with its expiry).
 *
 * The walls are a line each, not a button: logging in and upgrading are the
 * usage card's footer, so a second button here would ask twice.
 */
export function AiSubtitlesUsage() {
  const {
    data: session,
    isPending: isSessionPending,
    refetch: refetchSession,
  } = authClient.useSession()
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

  const status = errorStatus(usageQuery.error)

  // The background keeps the session for a day, so one the server has since
  // ended (signed out elsewhere, password changed) still reads as signed in,
  // and only this request finds out. Clear that cache and read the session
  // again, once: the whole card then turns into the logged-out one, with its
  // Log in button, and so does the sidebar.
  const isStaleSession = isSignedIn && status === 401
  const hasRecheckedSessionRef = useRef(false)
  useEffect(() => {
    if (!isStaleSession || hasRecheckedSessionRef.current) {
      return
    }
    hasRecheckedSessionRef.current = true
    void (async () => {
      await sendMessage("invalidateAuthCache").catch(() => {})
      await refetchSession()
    })()
  }, [isStaleSession, refetchSession])

  function renderContent() {
    if (isSessionPending || (isSignedIn && usageQuery.isPending)) {
      return <UsagePoolRowSkeleton />
    }

    // Not signed in, or a session the server has ended (see above).
    if (!isSignedIn || status === 401) {
      return <UsageNotice>{i18n.t("options.usage.logInToView")}</UsageNotice>
    }

    // A pre-launch server still gates getUsage behind the beta 403; the new
    // server answers free accounts with plan "free" instead. Both mean the
    // same thing now: this account needs a subscription. Drop this branch once
    // the server retires VIDEO_TRANSCRIPTION_BETA_RESTRICTED for good.
    if (status === 403 || usageQuery.data?.plan === "free") {
      return <UsageNotice>{i18n.t("options.videoSubtitles.aiQuota.upgradeRequired")}</UsageNotice>
    }

    if (usageQuery.isError || !usageQuery.data) {
      return <UsageNotice>{i18n.t("options.videoSubtitles.aiQuota.loadError")}</UsageNotice>
    }

    return <QuotaUsage usage={usageQuery.data} />
  }

  return (
    <UsageGroup
      id="subtitles-ai-quota"
      title={i18n.t("options.videoSubtitles.aiQuota.title")}
      description={i18n.t("options.videoSubtitles.aiQuota.description")}
    >
      {renderContent()}
    </UsageGroup>
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
 * The spent minutes and the pool's one meaningful date sit under the bar; the
 * bar turns red once 90% of the pool is gone.
 */
function QuotaPoolUsage({ pool }: { pool: VideoTranscriptUsagePool }) {
  const { usedMinutes, limitMinutes, remainingMinutes } = pool
  const remainingRatio = limitMinutes > 0 ? remainingMinutes / limitMinutes : 0
  const remainingPercent = Math.min(100, Math.max(0, remainingRatio * 100))

  const label =
    pool.id === "launchBonus"
      ? i18n.t("options.videoSubtitles.aiQuota.pools.launchBonus")
      : i18n.t("options.videoSubtitles.aiQuota.pools.subscription")
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
    <UsagePoolRow
      value={remainingPercent}
      remainingText={i18n.t("options.videoSubtitles.aiQuota.remainingOf", [
        remainingMinutes,
        limitMinutes,
      ])}
      label={label}
      meta={i18n.t("options.videoSubtitles.aiQuota.used", [usedMinutes])}
      note={dateNote}
      nearLimit={remainingRatio <= 1 - NEAR_LIMIT_RATIO}
    />
  )
}
