import { IconFileTextAi } from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { match } from "ts-pattern"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { Button } from "@/components/ui/base-ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/base-ui/empty"
import { Skeleton } from "@/components/ui/base-ui/skeleton"
import { configAtom } from "@/utils/atoms/config"
import { featureProviderRefAtom } from "@/utils/atoms/provider"
import { i18n } from "@/utils/i18n"
import { videoSummaryQueryKey } from "@/utils/subtitles/video-summary"
import { currentVideoIdAtom, subtitlesStore, videoSummaryPartialAtom } from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"

const SKELETON_LINE_WIDTHS = ["w-full", "w-11/12", "w-4/5", "w-10/12", "w-3/5"]

function StatusCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children?: React.ReactNode
}) {
  return (
    <Empty className="min-h-full p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle className="font-normal">{title}</EmptyTitle>
      </EmptyHeader>
      {children}
    </Empty>
  )
}

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

  const query = useQuery({
    // oxlint-disable-next-line query/exhaustive-deps -- Only the target language and resolved provider affect generation; the rest of this config snapshot must not invalidate the summary.
    queryKey: videoSummaryQueryKey(videoId, config.language.targetCode, providerRef),
    queryFn: async () => {
      const summary = await generateVideoSummary(config)
      if (!summary) {
        throw new Error("Empty summary")
      }
      return summary
    },
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    meta: { suppressToast: true },
  })

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
