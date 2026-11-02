import type { RefObject } from "react"
import { Icon } from "@iconify/react"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useRef, useState } from "react"
import { Switch } from "@/components/ui/base-ui/switch"
import {
  SelectionToolbarTooltip,
  useSelectionTooltipState,
} from "@/components/ui/selection-popover/selection-tooltip"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getAnnotationShortcut } from "@/utils/constants/selection"
import { i18n } from "@/utils/i18n"
import { ANNOTATION_ICON } from "@/utils/iconify/bundled-icons"
import { cn } from "@/utils/styles/utils"
import { isSelectionToolbarOpenAtom, selectionSessionAtom } from "../selection-toolbar/atoms"
import { ShortcutTooltipLabel } from "../selection-toolbar/shortcut-hint"
import { useAnnotation } from "./provider"

// The toolbar's leftmost slot: the pen, and the switch into annotation mode
// that slides out beside it. The slot sits outside the box the toolbar is
// measured and placed by, so opening it moves nothing: the bar's one chrome
// element (see the toolbar) extends its left edge over the slot instead.

/** The open slot's width: the switch with a little room either side. */
export const ANNOTATE_REVEAL_WIDTH_PX = 36
const REVEAL_CLOSE_DELAY_MS = 150
/** Breathing room between the open slot and the viewport's left edge. */
const REVEAL_EDGE_GAP_PX = 4

/** The reveal's state, owned by the toolbar so the pen and the slot agree. */
export function useAnnotateReveal(toolbarRef: RefObject<HTMLElement | null>, visible: boolean) {
  const [open, setOpen] = useState(false)
  // How far the toolbar moves right to make room for the slot, when it sits
  // against the viewport's left edge; 0 otherwise.
  const [shift, setShift] = useState(0)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }, [])

  const openReveal = useCallback(() => {
    cancelClose()
    // Where the toolbar is laid out, not where it is drawn: its bounding rect
    // counts the shift already applied (or half of it, mid-transition), and
    // hovering the pen again would take the shift back.
    const toolbar = toolbarRef.current
    const parentLeft = toolbar?.offsetParent?.getBoundingClientRect().left
    const left =
      toolbar && parentLeft !== undefined
        ? parentLeft + toolbar.offsetLeft
        : Number.POSITIVE_INFINITY
    setShift(Math.max(0, ANNOTATE_REVEAL_WIDTH_PX + REVEAL_EDGE_GAP_PX - left))
    setOpen(true)
  }, [cancelClose, toolbarRef])

  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null
      if (toolbarRef.current?.matches(":focus-within")) return
      setOpen(false)
      setShift(0)
    }, REVEAL_CLOSE_DELAY_MS)
  }, [cancelClose, toolbarRef])

  useEffect(() => {
    if (!visible) {
      cancelClose()
      // oxlint-disable-next-line react/set-state-in-effect -- the reveal follows the toolbar closing
      setOpen(false)
      setShift(0)
    }
  }, [cancelClose, visible])

  useEffect(() => cancelClose, [cancelClose])

  return { open, shift, openReveal, scheduleClose, cancelClose }
}

/** The pen: annotates the selection and closes the toolbar. */
export function AnnotateButton({ onPointerEnter }: { onPointerEnter: () => void }) {
  const { annotate } = useAnnotation()
  const { annotation } = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const session = useAtomValue(selectionSessionAtom)
  const setIsSelectionToolbarOpen = useSetAtom(isSelectionToolbarOpenAtom)
  const {
    handlePress,
    onOpenChange: handleTooltipOpenChange,
    open: tooltipOpen,
  } = useSelectionTooltipState()
  const label = i18n.t("annotation.annotate")

  const handleClick = useCallback(() => {
    if (annotate(session, ANALYTICS_SURFACE.SELECTION_TOOLBAR)) {
      handlePress()
      setIsSelectionToolbarOpen(false)
    }
  }, [annotate, handlePress, session, setIsSelectionToolbarOpen])

  return (
    <SelectionToolbarTooltip
      content={<ShortcutTooltipLabel label={label} shortcut={getAnnotationShortcut(annotation)} />}
      open={tooltipOpen}
      onOpenChange={handleTooltipOpenChange}
      render={
        <button
          type="button"
          className="flex h-7 shrink-0 cursor-pointer items-center justify-center px-2 hover:bg-muted"
          onClick={handleClick}
          onPointerEnter={onPointerEnter}
          onFocus={onPointerEnter}
          aria-label={label}
        />
      }
    >
      <Icon icon={ANNOTATION_ICON} className="size-4.5" />
    </SelectionToolbarTooltip>
  )
}

/** The switch into annotation mode, in the slot that opens at the toolbar's left edge. */
export function AnnotateReveal({ open }: { open: boolean }) {
  const { mode, setMode } = useAnnotation()
  const setIsSelectionToolbarOpen = useSetAtom(isSelectionToolbarOpenAtom)
  const label = i18n.t("annotation.enterMode")

  return (
    <div
      data-slot="annotation-reveal"
      aria-hidden={!open}
      className={cn(
        "absolute inset-y-0 right-full flex items-center justify-center overflow-hidden transition-[width] duration-150 ease-out",
        open ? "w-9" : "w-0",
      )}
    >
      <SelectionToolbarTooltip
        content={label}
        render={<span className="flex h-7 w-9 shrink-0 items-center justify-center" />}
      >
        <Switch
          size="sm"
          checked={mode}
          aria-label={label}
          tabIndex={open ? 0 : -1}
          onCheckedChange={(checked) => {
            setMode(checked)
            if (checked) setIsSelectionToolbarOpen(false)
          }}
        />
      </SelectionToolbarTooltip>
    </div>
  )
}
