import { IconChevronLeft } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { Activity, useLayoutEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { Button } from "@/components/ui/base-ui/button"
import { cn } from "@/utils/styles/utils"
import { subtitlesTranslateButtonAtom } from "../../atoms"
import { useSubtitlesUI } from "../subtitles-ui-context"
import { useControlsInfo } from "../use-controls-visible"
import { useSubtitlesPanelDismiss } from "./components/use-subtitles-panel-dismiss"
import {
  clampMenuLeft,
  getControlsRow,
  getMenuLeft,
  isMenuInControls,
  MENU_CONTROLS_GAP,
} from "./menu-placement"

type TransitionDirection = "back" | "forward"

interface PanelShellProps {
  children: React.ReactNode
  open: boolean
  onClose: () => void
  header?: { title: string; onBack: () => void }
  transition?: { key: string; direction: TransitionDirection }
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
        "animate-in duration-200 ease-out fade-in-0",
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
      className="pointer-events-auto relative isolate z-40 flex w-[min(17rem,calc(100cqw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-md backdrop-blur-2xl"
      style={{ maxHeight }}
    >
      <Activity mode={header ? "visible" : "hidden"}>
        <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
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

          <div className="min-w-0 truncate text-xs font-medium">{header?.title}</div>
        </div>
      </Activity>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {transition ? (
          <TransitionContent direction={transition.direction} transitionKey={transition.key}>
            {children}
          </TransitionContent>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

interface MenuPosition {
  left: number
  /** Just under the button, for a menu that opens down from controls at the top. */
  top: number
}

// The button sits anywhere in the controls row, so the menu follows it instead of the video's edge.
function useMenuPosition(
  open: boolean,
  inControls: boolean,
  rootRef: React.RefObject<HTMLDivElement | null>,
  panelRef: React.RefObject<HTMLDivElement | null>,
): MenuPosition | null {
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const button = useAtomValue(subtitlesTranslateButtonAtom)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!open || !root) {
      setPosition(null)
      return undefined
    }

    const place = (prev: MenuPosition | null): MenuPosition | null => {
      const panel = panelRef.current
      if (!panel) return prev
      const box = inControls
        ? { left: 0, top: 0, width: document.documentElement.clientWidth }
        : root.getBoundingClientRect()
      const buttonRect = button?.getBoundingClientRect()
      if (buttonRect?.width) {
        return {
          left: getMenuLeft(buttonRect, box, panel.offsetWidth),
          top: buttonRect.bottom - box.top + MENU_CONTROLS_GAP,
        }
      }
      // A button gone with the hidden controls leaves the menu where it was, inside the video.
      return prev && { ...prev, left: clampMenuLeft(prev.left, box.width, panel.offsetWidth) }
    }

    let row: Element | null = null
    // The row resizes when the player relabels a control beside the button, shifting it sideways.
    const watchRow = () => {
      const next = button ? getControlsRow(button) : null
      if (next && next !== row) resizeObserver.observe(next)
      row = next ?? row
    }
    const replace = () => {
      watchRow()
      // Commits before the resized frame paints, so the menu moves with the video, not a frame late.
      flushSync(() => setPosition(place))
    }

    setPosition(place)
    const resizeObserver = new ResizeObserver(replace)
    resizeObserver.observe(root)
    // A remounted button registers before its host is in the page; its first box re-places the menu.
    if (button) resizeObserver.observe(button)
    watchRow()
    window.addEventListener("resize", replace)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", replace)
    }
  }, [open, inControls, button, rootRef, panelRef])

  return position
}

export function PanelShell({ children, open, onClose, header, transition }: PanelShellProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { controlsConfig, embedded, openBelow } = useSubtitlesUI()
  const { controlsHeight, controlsVisible } = useControlsInfo(rootRef, controlsConfig)
  const inControls = isMenuInControls(embedded)
  const position = useMenuPosition(open, inControls, rootRef, panelRef)

  const offset =
    openBelow && position ? position.top : controlsVisible ? controlsHeight + MENU_CONTROLS_GAP : 22

  useSubtitlesPanelDismiss({
    enabled: open,
    onClose,
    panelRef,
  })

  return (
    <div
      ref={rootRef}
      className={
        inControls
          ? "pointer-events-none relative z-40 h-full font-light"
          : "[container-type:size] pointer-events-none absolute inset-0 z-40 overflow-visible font-light"
      }
    >
      {/* Activity pauses Jotai subscriptions while hidden, leaving the switch stale after navigation. */}
      <div
        className={cn(
          inControls ? "fixed" : "absolute",
          position === null && "right-4",
          "z-40 transition-[bottom,opacity,transform] duration-200 ease-out",
          open ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
        style={{
          ...(openBelow ? { top: `${offset}px` } : { bottom: `${offset}px` }),
          ...(position && { left: `${position.left}px` }),
        }}
        hidden={!open}
      >
        <PanelContent
          panelRef={panelRef}
          header={header}
          transition={transition}
          maxHeight={`calc(100cqh - ${offset}px - 1rem)`}
        >
          {children}
        </PanelContent>
      </div>
    </div>
  )
}
