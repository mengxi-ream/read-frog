import { IconArrowDown, IconArrowUp, IconFileText } from "@tabler/icons-react"
import { useRef } from "react"
import { match } from "ts-pattern"
import { Button } from "@/components/ui/base-ui/button"
import { Spinner } from "@/components/ui/base-ui/spinner"
import { i18n } from "@/utils/i18n"
import { useSubtitlesUI } from "../../../subtitles-ui-context"
import { StatusCard } from "../status-card"
import { TranscriptRow } from "./row"
import { useActiveRowVisibility } from "./use-active-row-visibility"
import { useFollowIntent } from "./use-follow-intent"
import { useTranscriptLines } from "./use-transcript-lines"

export function TranscriptSection() {
  const { seekTo } = useSubtitlesUI()
  const { lines, activeIndex, query } = useTranscriptLines()

  const rootRef = useRef<HTMLDivElement>(null)
  const activeRowRef = useRef<HTMLButtonElement>(null)
  const { following, resume, intentProps } = useFollowIntent(rootRef, lines.length > 0)
  const activeAbove = useActiveRowVisibility(rootRef, activeRowRef, activeIndex, following)

  if (lines.length === 0) {
    return match(query)
      .with({ status: "pending" }, () => (
        <StatusCard icon={<Spinner />} title={i18n.t("subtitles.sidebar.transcript.loading")} />
      ))
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
