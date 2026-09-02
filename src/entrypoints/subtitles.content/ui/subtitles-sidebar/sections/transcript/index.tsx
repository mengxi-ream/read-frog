import { IconArrowDown, IconArrowUp, IconFileText } from "@tabler/icons-react"
import { useRef } from "react"
import { match } from "ts-pattern"
import { Button } from "@/components/ui/base-ui/button"
import { Skeleton } from "@/components/ui/base-ui/skeleton"
import { i18n } from "@/utils/i18n"
import { useSubtitlesUI } from "../../../subtitles-ui-context"
import { StatusCard } from "../status-card"
import { TranscriptRow } from "./row"
import { useActiveRowVisibility } from "./use-active-row-visibility"
import { useFollowIntent } from "./use-follow-intent"
import { useTranscriptLines } from "./use-transcript-lines"

const SKELETON_ROWS = [
  ["w-full", "w-11/12"],
  ["w-10/12", "w-3/5"],
  ["w-11/12", "w-4/5"],
  ["w-4/5", "w-2/3"],
  ["w-full", "w-3/4"],
  ["w-3/4", "w-1/2"],
  ["w-11/12", "w-7/12"],
  ["w-full", "w-2/3"],
  ["w-10/12", "w-1/2"],
  ["w-4/5", "w-3/4"],
]

function TranscriptSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {SKELETON_ROWS.map(([text, translation]) => (
        <div key={`${text}-${translation}`} className="px-3 py-2.5">
          <div className="flex h-5 items-center">
            <Skeleton className="h-3 w-10 bg-foreground/18" />
          </div>
          <div className="mt-0.5 flex h-[22.75px] items-center">
            <Skeleton className={`h-3.5 bg-foreground/18 ${text}`} />
          </div>
          <div className="mt-1 flex h-[22.75px] items-center">
            <Skeleton className={`h-3.5 bg-foreground/18 ${translation}`} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TranscriptSection() {
  const { seekTo } = useSubtitlesUI()
  const { lines, activeIndex, query } = useTranscriptLines()

  const rootRef = useRef<HTMLDivElement>(null)
  const activeRowRef = useRef<HTMLButtonElement>(null)
  const { following, resume, intentProps } = useFollowIntent(rootRef, lines.length > 0)
  const activeAbove = useActiveRowVisibility(rootRef, activeRowRef, activeIndex, following)

  if (lines.length === 0) {
    return match(query)
      .with({ status: "pending" }, () => <TranscriptSkeleton />)
      .with({ status: "error" }, () => (
        <StatusCard
          icon={<IconFileText />}
          title={i18n.t("subtitles.sidebar.transcript.failedTitle")}
        >
          <Button type="button" variant="brand" size="sm" onClick={() => void query.refetch()}>
            {i18n.t("subtitles.sidebar.transcript.retry")}
          </Button>
        </StatusCard>
      ))
      .with({ status: "success" }, () => (
        <StatusCard
          icon={<IconFileText />}
          title={i18n.t("subtitles.sidebar.transcript.emptyTitle")}
        />
      ))
      .exhaustive()
  }

  const backToCurrent = (
    <Button
      type="button"
      variant="brand"
      size="sm"
      onClick={resume}
      className="pointer-events-auto shadow-floating"
    >
      {activeAbove ? <IconArrowUp className="size-3.5" /> : <IconArrowDown className="size-3.5" />}
      {i18n.t("subtitles.sidebar.transcript.backToCurrent")}
    </Button>
  )

  return (
    <div ref={rootRef} className="relative" {...intentProps}>
      {!following && activeAbove && (
        <div className="pointer-events-none sticky top-3 z-10 flex h-0 items-start justify-center">
          {backToCurrent}
        </div>
      )}
      <div className="space-y-1 p-2">
        {lines.map((line, index) => (
          <TranscriptRow
            key={line.start}
            line={line}
            isActive={index === activeIndex}
            activeRowRef={index === activeIndex ? activeRowRef : undefined}
            onSeek={seekTo}
          />
        ))}
      </div>

      {!following && !activeAbove && (
        <div className="pointer-events-none sticky bottom-3 z-10 flex h-0 items-end justify-center">
          {backToCurrent}
        </div>
      )}
    </div>
  )
}
