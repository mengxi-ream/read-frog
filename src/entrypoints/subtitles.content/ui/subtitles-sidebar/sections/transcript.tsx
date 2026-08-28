import { IconArrowDown, IconArrowUp, IconFileText } from "@tabler/icons-react"
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
import {
  currentTimeMsAtom,
  currentVideoIdAtom,
  sourceTrackAtom,
  translatedTrackAtom,
} from "../../../atoms"
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
  const videoId = useAtomValue(currentVideoIdAtom)

  const lines = useMemo(() => buildTranscript(source, translated), [source, translated])
  const activeIndex = findActiveLine(lines, timeMs)

  const [following, setFollowing] = useState(true)
  const [activeAbove, setActiveAbove] = useState(false)
  const activeRef = useRef<HTMLButtonElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const query = useQuery({
    queryKey: ["subtitles", "source-track", videoId],
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

  // The scroller belongs to the shell's ScrollArea, so the active row's side of
  // it can only be read by measuring against that viewport.
  useEffect(() => {
    if (following) {
      setActiveAbove(false)
      return undefined
    }
    const viewport = rootRef.current?.closest('[data-slot="scroll-area-viewport"]')
    if (!viewport) return undefined

    const update = () => {
      const row = activeRef.current
      if (!row) {
        setActiveAbove(false)
        return
      }
      setActiveAbove(row.getBoundingClientRect().bottom < viewport.getBoundingClientRect().top)
    }
    update()
    viewport.addEventListener("scroll", update, { passive: true })
    return () => viewport.removeEventListener("scroll", update)
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

  const backToCurrent = (
    <Button
      type="button"
      variant="brand"
      size="sm"
      onClick={() => setFollowing(true)}
      className="pointer-events-auto shadow-floating"
    >
      {activeAbove ? <IconArrowUp className="size-3.5" /> : <IconArrowDown className="size-3.5" />}
      {i18n.t("subtitles.sidebar.transcript.backToCurrent")}
    </Button>
  )

  return (
    <div
      ref={rootRef}
      className="relative"
      onWheel={stopFollowing}
      onTouchMove={stopFollowing}
      onKeyDown={onKeyDown}
    >
      {/* Sticky-top only pins when it precedes the content, so the two placements
          are separate slots rather than one element that moves. The zero-height
          wrapper keeps either from displacing a row. */}
      {!following && activeAbove && (
        <div className="pointer-events-none sticky top-3 z-10 flex h-0 items-start justify-center">
          {backToCurrent}
        </div>
      )}
      <div className="space-y-1 p-2">
        {lines.map((line, index) => {
          const isActive = index === activeIndex

          return (
            <button
              key={line.start}
              ref={isActive ? activeRef : undefined}
              type="button"
              aria-current={isActive || undefined}
              onClick={() => seekTo(line.start / 1000)}
              className={cn(
                "block w-full rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                isActive ? "bg-brand/20" : "hover:bg-muted/40",
              )}
            >
              <span className="block font-mono text-[12px] leading-5 text-foreground/65 tabular-nums">
                {formatTime(line.start)}
              </span>
              <span
                className={cn(
                  "mt-0.5 block text-[14px] leading-relaxed transition-colors",
                  isActive ? "text-foreground" : "text-foreground/85",
                )}
              >
                {line.text}
              </span>
              {line.translation && (
                <span
                  className={cn(
                    "mt-1 block text-[14px] leading-relaxed transition-colors",
                    isActive ? "text-foreground" : "text-foreground/70",
                  )}
                >
                  {line.translation}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {!following && !activeAbove && (
        <div className="pointer-events-none sticky bottom-3 z-10 flex h-0 items-end justify-center">
          {backToCurrent}
        </div>
      )}
    </div>
  )
}
