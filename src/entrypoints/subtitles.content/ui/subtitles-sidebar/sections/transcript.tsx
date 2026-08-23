import { IconArrowDown, IconFileText } from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { useEffect, useMemo, useRef, useState } from "react"
import { match } from "ts-pattern"
import { Button } from "@/components/ui/base-ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/base-ui/empty"
import { Spinner } from "@/components/ui/base-ui/spinner"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { buildTranscript, findActiveLine } from "@/utils/subtitles/transcript"
import { currentTimeMsAtom, sourceTrackAtom, translatedTrackAtom } from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const seconds = String(total % 60).padStart(2, "0")
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function TranscriptSection() {
  const { ensureSourceTrackPublished, seekTo } = useSubtitlesUI()
  const source = useAtomValue(sourceTrackAtom)
  const translated = useAtomValue(translatedTrackAtom)
  const timeMs = useAtomValue(currentTimeMsAtom)

  const lines = useMemo(() => buildTranscript(source, translated), [source, translated])
  const activeIndex = findActiveLine(lines, timeMs)

  const [following, setFollowing] = useState(true)
  const activeRef = useRef<HTMLButtonElement>(null)

  const query = useQuery({
    queryKey: ["subtitles", "source-track"],
    queryFn: async () => {
      await ensureSourceTrackPublished()
      return true
    },
    enabled: lines.length === 0,
    retry: false,
    staleTime: Infinity,
    meta: { suppressToast: true },
  })

  useEffect(() => {
    if (!following || activeIndex < 0) return
    activeRef.current?.scrollIntoView({
      block: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    })
  }, [following, activeIndex])

  // Intent, not the scroll event: programmatic scrolling fires `scroll` too, so
  // reading that would make following switch itself off.
  const stopFollowing = () => setFollowing(false)
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) {
      stopFollowing()
    }
  }

  if (lines.length === 0) {
    return match(query)
      .with({ status: "pending" }, () => (
        <Empty className="min-h-full p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Spinner />
            </EmptyMedia>
            <EmptyTitle className="font-normal">
              {i18n.t("subtitles.sidebar.transcript.loading")}
            </EmptyTitle>
          </EmptyHeader>
        </Empty>
      ))
      .with({ status: "error" }, () => (
        <Empty className="min-h-full p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconFileText />
            </EmptyMedia>
            <EmptyTitle className="font-normal">
              {i18n.t("subtitles.sidebar.transcript.failedTitle")}
            </EmptyTitle>
          </EmptyHeader>
          <Button type="button" variant="brand" size="sm" onClick={() => void query.refetch()}>
            {i18n.t("subtitles.sidebar.transcript.retry")}
          </Button>
        </Empty>
      ))
      .with({ status: "success" }, () => (
        <Empty className="min-h-full p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconFileText />
            </EmptyMedia>
            <EmptyTitle className="font-normal">
              {i18n.t("subtitles.sidebar.transcript.emptyTitle")}
            </EmptyTitle>
          </EmptyHeader>
        </Empty>
      ))
      .exhaustive()
  }

  return (
    <div
      className="relative"
      onWheel={stopFollowing}
      onTouchMove={stopFollowing}
      onKeyDown={onKeyDown}
    >
      <div className="py-2 pr-3 pl-2">
        {lines.map((line, index) => {
          const isActive = index === activeIndex
          const isPlayed = activeIndex >= 0 && index < activeIndex

          return (
            <button
              key={line.start}
              ref={isActive ? activeRef : undefined}
              type="button"
              aria-current={isActive || undefined}
              onClick={() => seekTo(line.start / 1000)}
              className={cn(
                "group grid w-full grid-cols-[2.75rem_0.75rem_1fr] rounded-[10px] text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                isActive ? "bg-brand/8" : "hover:bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "pt-2 pr-1 text-right font-mono text-[11px] leading-5 tabular-nums transition-colors",
                  isActive ? "text-brand" : "text-muted-foreground/60",
                )}
              >
                {formatTime(line.start)}
              </span>

              {/* The rail is the axis and the progress bar at once: it fills
                  behind the playhead and stays hairline ahead of it. */}
              <span className="relative" aria-hidden>
                <span
                  className={cn(
                    "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors",
                    isPlayed || isActive ? "bg-brand/70" : "bg-border/50",
                  )}
                />
                <span
                  className={cn(
                    "absolute top-[0.85rem] left-1/2 size-1.5 -translate-x-1/2 rounded-full transition-all",
                    isActive
                      ? "bg-brand ring-3 ring-brand/20"
                      : "bg-border opacity-0 group-hover:opacity-100",
                  )}
                />
              </span>

              <span className="min-w-0 py-2 pr-1 pl-2">
                <span
                  className={cn(
                    "block text-[13px] leading-relaxed transition-colors",
                    isActive ? "font-medium text-foreground" : "text-foreground/70",
                  )}
                >
                  {line.text}
                </span>
                {line.translation && (
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
                    {line.translation}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {!following && (
        <Button
          type="button"
          variant="brand"
          size="sm"
          onClick={() => setFollowing(true)}
          className="sticky bottom-3 left-1/2 -translate-x-1/2 shadow-floating"
        >
          <IconArrowDown className="size-3.5" />
          {i18n.t("subtitles.sidebar.transcript.backToCurrent")}
        </Button>
      )}
    </div>
  )
}
