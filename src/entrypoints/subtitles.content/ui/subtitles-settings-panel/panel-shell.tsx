import type { RefObject } from "react"
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

export function PanelShell({
  children,
  open,
  onClose,
  header,
  transition,
}: PanelShellProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { controlsConfig } = useSubtitlesUI()
  const { controlsHeight, controlsVisible } = useControlsInfo(rootRef as RefObject<HTMLElement>, controlsConfig)

  const bottomOffset = useMemo(
    () => (controlsVisible ? controlsHeight + 18 : 22),
    [controlsHeight, controlsVisible],
  )

  useSubtitlesPanelDismiss({
    enabled: open,
    onClose,
    panelRef,
  })

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-40 pointer-events-none overflow-visible font-light"
    >
      <Activity mode={open ? "visible" : "hidden"}>
        <div
          className={cn(
            "absolute right-4 z-40 transition-[bottom,opacity,transform] duration-200 ease-out",
            open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          )}
          style={{ bottom: `${bottomOffset}px` }}
        >
          <div
            ref={panelRef}
            data-slot="subtitles-settings-panel"
            className="pointer-events-auto relative isolate z-40 w-[min(17rem,calc(100vw-2rem))] overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,20,25,0.95)_0%,rgba(10,12,16,0.9)_100%)] text-white shadow-[0_22px_48px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/14" />
            <div className="pointer-events-none absolute -right-12 -bottom-14 size-32 rounded-full bg-[#d8a94b]/9 blur-3xl" />

            {header && (
              <div className="flex items-center gap-3 border-b border-white/8 px-4 pt-3 pb-3">
                <Button
                  type="button"
                  variant="ghost-secondary"
                  size="icon-sm"
                  aria-label="Back to subtitles menu"
                  onClick={header.onBack}
                  className="rounded-full border border-white/10 bg-white/[0.03] text-white/82 hover:border-white/14 hover:bg-white/[0.08] hover:text-white"
                >
                  <IconChevronLeft className="size-4" />
                </Button>

                <div className="min-w-0 truncate text-sm font-medium text-white/94">
                  {header.title}
                </div>
              </div>
            )}

            <div className="min-h-0 overflow-hidden">
              {transition
                ? (
                    <TransitionContent direction={transition.direction} transitionKey={transition.key}>
                      {children}
                    </TransitionContent>
                  )
                : children}
            </div>
          </div>
        </div>
      </Activity>
    </div>
  )
}
