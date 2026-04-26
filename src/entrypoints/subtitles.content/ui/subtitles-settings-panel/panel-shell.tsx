import { IconChevronLeft } from "@tabler/icons-react"
import { Activity, useMemo, useRef } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { cn } from "@/utils/styles/utils"
import { useSubtitlesUI } from "../subtitles-ui-context"
import { useControlsInfo } from "../use-controls-visible"
import { useSubtitlesPanelDismiss } from "./components/use-subtitles-panel-dismiss"

type TransitionDirection = "back" | "forward"

interface PanelShellProps {
  children: React.ReactNode
  open: boolean
  onClose: () => void
  header?: { title: string, onBack: () => void }
  transition?: { key: string, direction: TransitionDirection }
}

function TransitionContent({
  children,
  direction,
  transitionKey,
}: {
  children: React.ReactNode
  direction: TransitionDirection
  transitionKey: string
}) {
  return (
    <div
      key={transitionKey}
      data-direction={direction}
      className={cn(
        "duration-200 ease-out animate-in fade-in-0",
        direction === "forward" ? "slide-in-from-right-3" : "slide-in-from-left-3",
      )}
    >
      {children}
    </div>
  )
}

function PanelContent({
  children,
  panelRef,
  header,
  transition,
  maxHeight,
}: {
  children: React.ReactNode
  panelRef: React.RefObject<HTMLDivElement | null>
  header?: PanelShellProps["header"]
  transition?: PanelShellProps["transition"]
  maxHeight?: string
}) {
  return (
    <div
      ref={panelRef}
      data-slot="subtitles-settings-panel"
      className="bg-popover text-popover-foreground border-border pointer-events-auto relative isolate z-40 flex w-[min(19rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[20px] border shadow-floating backdrop-blur-2xl"
      style={{ maxHeight }}
    >
      <Activity mode={header ? "visible" : "hidden"}>
        <div className="border-border flex items-center gap-3 border-b px-4 pt-3 pb-3">
          <Button
            type="button"
            variant="ghost-secondary"
            size="icon-sm"
            aria-label="Back to subtitles menu"
            onClick={header?.onBack}
            className="rounded-full"
          >
            <IconChevronLeft className="size-4" />
          </Button>

          <div className="min-w-0 truncate text-xs font-medium">
            {header?.title}
          </div>
        </div>
      </Activity>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {transition
          ? (
              <TransitionContent direction={transition.direction} transitionKey={transition.key}>
                {children}
              </TransitionContent>
            )
          : children}
      </div>
    </div>
  )
}

export function PanelShell({
  children,
  open,
  onClose,
  header,
  transition,
}: PanelShellProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { controlsConfig, embedded } = useSubtitlesUI()
  const { controlsHeight, controlsVisible } = useControlsInfo(rootRef, controlsConfig)

  const bottomOffset = useMemo(
    () => (controlsVisible ? controlsHeight + 18 : 22),
    [controlsHeight, controlsVisible],
  )

  useSubtitlesPanelDismiss({
    enabled: open,
    onClose,
    panelRef,
  })

  const rootClassName = embedded
    ? "relative z-40 pointer-events-none font-light h-full"
    : "absolute inset-0 z-40 pointer-events-none overflow-visible font-light [container-type:size]"

  const positionClassName = cn(
    "absolute z-40 transition-[bottom,opacity,transform] duration-200 ease-out",
    embedded ? "bottom-full right-0" : "right-4",
    open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
  )

  const positionStyle = embedded
    ? { marginBottom: `${bottomOffset}px` }
    : { bottom: `${bottomOffset}px` }

  const maxHeight = embedded
    ? "min(24rem, 60vh)"
    : `calc(100cqh - ${bottomOffset}px - 1rem)`

  return (
    <div ref={rootRef} className={rootClassName}>
      <Activity mode={open ? "visible" : "hidden"}>
        <div className={positionClassName} style={positionStyle}>
          <PanelContent
            panelRef={panelRef}
            header={header}
            transition={transition}
            maxHeight={maxHeight}
          >
            {children}
          </PanelContent>
        </div>
      </Activity>
    </div>
  )
}
