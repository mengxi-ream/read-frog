import { ORPCError } from "@orpc/client"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/base-ui/button"
import { Progress } from "@/components/ui/base-ui/progress"
import { Skeleton } from "@/components/ui/base-ui/skeleton"
import { openLogIn } from "@/components/user-account-menu/shared"
import { authClient } from "@/utils/auth/auth-client"
import { VIDEO_TRANSCRIPTION_APPLY_URL } from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"
import { orpc } from "@/utils/orpc/client"
import { cn } from "@/utils/styles/utils"
import { ConfigCard } from "../../components/config-card"

const NEAR_LIMIT_RATIO = 0.9

interface QuotaUsageData {
  usedMinutes: number
  limitMinutes: number
  remainingMinutes: number
}

function errorStatus(error: unknown): number | null {
  return error instanceof ORPCError ? error.status : null
}

export function SubtitlesAiQuota() {
  const { data: session, isPending: isSessionPending } = authClient.useSession()
  const isSignedIn = !!session?.user

  const usageQuery = useQuery(
    orpc.videoTranscript.getUsage.queryOptions({
      enabled: isSignedIn,
      retry: false,
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

    // Signed in but without beta access (403) -> prompt to apply, not to log in.
    if (status === 403) {
      return <QuotaBetaGuide />
    }

    if (usageQuery.isError || !usageQuery.data) {
      return (
        <p className="text-sm text-muted-foreground">
          {i18n.t("options.videoSubtitles.aiQuota.loadError")}
        </p>
      )
    }

    return <QuotaUsage usage={usageQuery.data} />
  }

  return (
    <ConfigCard
      id="subtitles-ai-quota"
      title={i18n.t("options.videoSubtitles.aiQuota.title")}
      description={i18n.t("options.videoSubtitles.aiQuota.description")}
    >
      {renderContent()}
    </ConfigCard>
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

function QuotaLoginGuide() {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">
        {i18n.t("options.videoSubtitles.aiQuota.loginRequired")}
      </p>
      <Button variant="outline" size="sm" onClick={openLogIn}>
        {i18n.t("options.videoSubtitles.aiQuota.logIn")}
      </Button>
    </div>
  )
}

function QuotaBetaGuide() {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">
        {i18n.t("options.videoSubtitles.aiQuota.betaRequired")}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(VIDEO_TRANSCRIPTION_APPLY_URL, "_blank")}
      >
        {i18n.t("options.videoSubtitles.aiQuota.betaApply")}
      </Button>
    </div>
  )
}

function QuotaUsage({ usage }: { usage: QuotaUsageData }) {
  const { usedMinutes, limitMinutes, remainingMinutes } = usage
  const ratio = limitMinutes > 0 ? usedMinutes / limitMinutes : 0
  const percent = Math.min(100, Math.max(0, ratio * 100))
  const isNearLimit = ratio >= NEAR_LIMIT_RATIO

  return (
    <div className="flex flex-col gap-3">
      <Progress
        value={percent}
        className={cn(isNearLimit && "[&_[data-slot=progress-indicator]]:bg-destructive")}
      />
      <p className="text-sm text-muted-foreground tabular-nums">
        {i18n.t("options.videoSubtitles.aiQuota.summary", [
          usedMinutes,
          limitMinutes,
          remainingMinutes,
        ])}
      </p>
    </div>
  )
}
