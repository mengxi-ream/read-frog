import { IconFileTextAi } from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { match } from "ts-pattern"
import { browser } from "#imports"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { Button } from "@/components/ui/base-ui/button"
import { Skeleton } from "@/components/ui/base-ui/skeleton"
import { configAtom } from "@/utils/atoms/config"
import { featureProviderRefAtom } from "@/utils/atoms/provider"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import {
  checkVideoSummaryAvailability,
  videoSummaryQueryKey,
} from "@/utils/subtitles/video-summary"
import { currentVideoIdAtom, subtitlesStore, videoSummaryPartialAtom } from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { StatusCard } from "./status-card"

const SKELETON_LINE_WIDTHS = ["w-full", "w-11/12", "w-4/5", "w-10/12", "w-3/5"]

function SummaryBody({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-5">{children}</div>
}

function SummarySkeleton() {
  return (
    <SummaryBody>
      <div className="flex flex-col gap-3">
        {SKELETON_LINE_WIDTHS.map((width) => (
          <Skeleton key={width} className={`h-3.5 bg-foreground/18 ${width}`} />
        ))}
      </div>
    </SummaryBody>
  )
}

export function SummarySection() {
  const { generateVideoSummary } = useSubtitlesUI()
  const config = useAtomValue(configAtom)
  const providerRef = useAtomValue(featureProviderRefAtom("videoSubtitles"))
  const videoId = useAtomValue(currentVideoIdAtom, { store: subtitlesStore })
  const partial = useAtomValue(videoSummaryPartialAtom, { store: subtitlesStore })

  // Owned here rather than by the menu entry: the transcript tab needs no
  // model, so an unusable provider must not keep the panel shut.
  // Neither the key nor the freshness may be pinned to the id alone: repairing
  // the provider, or a quota that frees up, has to be able to reach this.
  const provider = useQuery({
    queryKey: ["subtitles", "summary-provider", providerRef],
    queryFn: checkVideoSummaryAvailability,
    retry: false,
    meta: { suppressToast: true },
  })

  const query = useQuery({
    // oxlint-disable-next-line query/exhaustive-deps -- Only the target language and resolved provider affect generation; the rest of this config snapshot must not invalidate the summary.
    queryKey: videoSummaryQueryKey(videoId, config.language.targetCode, providerRef),
    queryFn: async () => {
      const summary = await generateVideoSummary(config, videoId)
      if (!summary) {
        throw new Error("Empty summary")
      }
      return summary
    },
    retry: false,
    enabled: videoId !== null && provider.data?.status === "ok",
    staleTime: Infinity,
    gcTime: Infinity,
    meta: { suppressToast: true },
  })

  if (videoId === null) {
    return <SummarySkeleton />
  }

  if (provider.status === "error") {
    return (
      <StatusCard icon={<IconFileTextAi />} title={i18n.t("subtitles.sidebar.summary.failedTitle")}>
        <Button type="button" variant="brand" size="sm" onClick={() => void provider.refetch()}>
          {i18n.t("subtitles.sidebar.summary.retry")}
        </Button>
      </StatusCard>
    )
  }

  if (provider.data && provider.data.status !== "ok") {
    return (
      match(provider.data)
        .with({ status: "needsModel" }, () => (
          <StatusCard
            icon={<IconFileTextAi />}
            title={i18n.t("subtitles.sidebar.summary.needsModel")}
          >
            <Button
              type="button"
              variant="brand"
              size="sm"
              onClick={() =>
                void sendMessage("openPage", {
                  url: browser.runtime.getURL(
                    "/options.html#/api-providers?section=feature-providers",
                  ),
                  active: true,
                })
              }
            >
              {i18n.t("subtitles.sidebar.summary.openSettings")}
            </Button>
          </StatusCard>
        ))
        // Already actionable; a settings link would point away from it.
        .with({ status: "hostedUnavailable" }, ({ message }) => (
          <StatusCard icon={<IconFileTextAi />} title={message} />
        ))
        .exhaustive()
    )
  }

  return match(query)
    .with({ status: "pending" }, () =>
      partial ? (
        <SummaryBody>
          <MarkdownRenderer content={partial} />
        </SummaryBody>
      ) : (
        <SummarySkeleton />
      ),
    )
    .with({ status: "error" }, () => (
      <StatusCard icon={<IconFileTextAi />} title={i18n.t("subtitles.sidebar.summary.failedTitle")}>
        <Button type="button" variant="brand" size="sm" onClick={() => void query.refetch()}>
          {i18n.t("subtitles.sidebar.summary.retry")}
        </Button>
      </StatusCard>
    ))
    .with({ status: "success" }, ({ data }) => (
      <SummaryBody>
        <MarkdownRenderer content={data} />
      </SummaryBody>
    ))
    .exhaustive()
}
