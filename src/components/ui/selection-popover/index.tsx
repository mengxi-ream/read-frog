"use client"

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { IconGripHorizontal, IconPin, IconPinnedFilled, IconX } from "@tabler/icons-react"
import * as React from "react"
import { Rnd } from "react-rnd"
import { Button } from "@/components/ui/base-ui/button"
import {
  SELECTION_CONTENT_OVERLAY_LAYERS,
  SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE,
} from "@/entrypoints/selection.content/overlay-layers"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import { cn } from "@/utils/styles/utils"
import { usePreventScrollThrough } from "./use-prevent-scroll-through"
import {
  SELECTION_POPOVER_DRAG_HANDLE_CLASS,
  SELECTION_POPOVER_NO_DRAG_SELECTOR,
  SELECTION_POPOVER_RESIZE_HANDLE_STYLES,
  SELECTION_POPOVER_RESIZE_HANDLES,
  useSelectionPopoverLayout,
} from "./use-selection-popover-layout"

interface SelectionPopoverPosition {
  x: number
  y: number
}

interface SelectionPopoverActions {
  requestOpen: (anchor?: SelectionPopoverPosition | null) => void
}

type SelectionPopoverPortalContainer =
  | HTMLElement
  | ShadowRoot
  | React.RefObject<HTMLElement | ShadowRoot | null>
  | null

interface SelectionPopoverRootContextValue {
  open: boolean
  setOpen: (value: boolean | ((value: boolean) => boolean)) => void
  anchor: SelectionPopoverPosition | null
  setAnchor: (value: SelectionPopoverPosition | null) => void
  pinned: boolean
  setPinned: (value: boolean | ((value: boolean) => boolean)) => void
  requestOpen: (anchor?: SelectionPopoverPosition | null) => void
  triggerElement: HTMLElement | null
  setTriggerElement: React.Dispatch<React.SetStateAction<HTMLElement | null>>
}

interface SelectionPopoverContentContextValue {
  close: () => void
  isDragging: boolean
  portalContainer: SelectionPopoverPortalContainer
  setBodyElement: (node: HTMLDivElement | null) => void
}

const SelectionPopoverRootContext = React.createContext<SelectionPopoverRootContextValue | null>(
  null,
)
const SelectionPopoverContentContext =
  React.createContext<SelectionPopoverContentContextValue | null>(null)
const SELECTION_POPOVER_OPEN_EVENT = "read-frog:selection-popover-open"

function useSelectionPopoverRootContext() {
  const context = React.use(SelectionPopoverRootContext)
  if (!context) {
    throw new Error("SelectionPopover components must be used within SelectionPopover.Root.")
  }

  return context
}

function useSelectionPopoverContentContext() {
  const context = React.use(SelectionPopoverContentContext)
  if (!context) {
    throw new Error("SelectionPopover content slots must be used within SelectionPopover.Content.")
  }

  return context
}

export function useSelectionPopoverOverlayProps() {
  const context = React.use(SelectionPopoverContentContext)

  return {
    container: context?.portalContainer,
    positionerClassName: context ? SELECTION_CONTENT_OVERLAY_LAYERS.popoverOverlay : undefined,
  }
}

function SelectionPopoverRoot({
  anchor: anchorProp,
  children,
  defaultOpen = false,
  defaultPinned = false,
  disablePointerDismissal = false,
  open: openProp,
  pinned: pinnedProp,
  actionsRef,
  onAnchorChange,
  onOpenChange,
  onPinnedChange,
  onReuseRequest,
}: {
  anchor?: SelectionPopoverPosition | null
  children: React.ReactNode
  defaultOpen?: boolean
  defaultPinned?: boolean
  disablePointerDismissal?: boolean
  open?: boolean
  pinned?: boolean
  actionsRef?: React.RefObject<SelectionPopoverActions | null>
  onAnchorChange?: (anchor: SelectionPopoverPosition | null) => void
  onOpenChange?: (open: boolean) => void
  onPinnedChange?: (pinned: boolean) => void
  onReuseRequest?: (details: { anchor: SelectionPopoverPosition | null }) => void
}) {
  const instanceId = React.useId()
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const [uncontrolledAnchor, setUncontrolledAnchor] =
    React.useState<SelectionPopoverPosition | null>(null)
  const [uncontrolledPinned, setUncontrolledPinned] = React.useState(defaultPinned)
  const [triggerElement, setTriggerElement] = React.useState<HTMLElement | null>(null)
  const reopenFrameRef = React.useRef<number | null>(null)
  const open = openProp ?? uncontrolledOpen
  const anchor = anchorProp ?? uncontrolledAnchor
  const pinned = pinnedProp ?? uncontrolledPinned

  const setPinned = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const nextPinned = typeof value === "function" ? value(pinned) : value

      if (pinnedProp === undefined) {
        setUncontrolledPinned(nextPinned)
      }

      onPinnedChange?.(nextPinned)
    },
    [onPinnedChange, pinned, pinnedProp],
  )

  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const nextOpen = typeof value === "function" ? value(open) : value

      if (!nextOpen && pinned) {
        setPinned(false)
      }

      if (openProp === undefined) {
        setUncontrolledOpen(nextOpen)
      }

      onOpenChange?.(nextOpen)
    },
    [onOpenChange, open, openProp, pinned, setPinned],
  )

  const setAnchor = React.useCallback(
    (value: SelectionPopoverPosition | null) => {
      if (anchorProp === undefined) {
        setUncontrolledAnchor(value)
      }

      onAnchorChange?.(value)
    },
    [anchorProp, onAnchorChange],
  )

  const requestOpen = React.useCallback(
    (nextAnchor: SelectionPopoverPosition | null = null) => {
      if (open && pinned) {
        // A pinned popover is reused in place: keep its anchor, layout, and
        // pin state, and let the consumer swap session-scoped content via
        // onReuseRequest. Re-dispatch the open event to re-assert exclusivity.
        window.dispatchEvent(
          new CustomEvent(SELECTION_POPOVER_OPEN_EVENT, {
            detail: { instanceId },
          }),
        )
        onReuseRequest?.({ anchor: nextAnchor })
        return
      }

      if (open) {
        // Reopen on the next frame so controlled consumers observe a full
        // close/open cycle and can refresh session-scoped state from the
        // current selection.
        if (reopenFrameRef.current !== null) {
          cancelAnimationFrame(reopenFrameRef.current)
        }
        setOpen(false)
        reopenFrameRef.current = requestAnimationFrame(() => {
          reopenFrameRef.current = null
          if (nextAnchor) {
            setAnchor(nextAnchor)
          }
          setOpen(true)
        })
        return
      }

      if (nextAnchor) {
        setAnchor(nextAnchor)
      }
      setOpen(true)
    },
    [instanceId, onReuseRequest, open, pinned, setAnchor, setOpen],
  )

  React.useImperativeHandle(actionsRef, () => ({ requestOpen }), [requestOpen])

  React.useEffect(() => {
    return () => {
      if (reopenFrameRef.current !== null) {
        cancelAnimationFrame(reopenFrameRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePeerPopoverOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{ instanceId?: string }>
      if (customEvent.detail?.instanceId && customEvent.detail.instanceId !== instanceId) {
        setOpen(false)
      }
    }

    window.addEventListener(SELECTION_POPOVER_OPEN_EVENT, handlePeerPopoverOpen)
    window.dispatchEvent(
      new CustomEvent(SELECTION_POPOVER_OPEN_EVENT, {
        detail: { instanceId },
      }),
    )

    return () => {
      window.removeEventListener(SELECTION_POPOVER_OPEN_EVENT, handlePeerPopoverOpen)
    }
  }, [instanceId, open, setOpen])

  const contextValue = React.useMemo(
    () => ({
      open,
      setOpen,
      anchor,
      setAnchor,
      pinned,
      setPinned,
      requestOpen,
      triggerElement,
      setTriggerElement,
    }),
    [anchor, open, pinned, requestOpen, setAnchor, setOpen, setPinned, triggerElement],
  )

  return (
    <SelectionPopoverRootContext value={contextValue}>
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
        }}
        disablePointerDismissal={pinned || disablePointerDismissal}
        modal={false}
      >
        {children}
      </DialogPrimitive.Root>
    </SelectionPopoverRootContext>
  )
}

function SelectionPopoverTrigger({
  className,
  children,
  render,
  ...props
}: useRender.ComponentProps<"button"> & React.ComponentProps<"button">) {
  const { open, requestOpen, setTriggerElement } = useSelectionPopoverRootContext()

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      setTriggerElement(event.currentTarget)
      requestOpen({ x: rect.left, y: rect.top })
    },
    [requestOpen, setTriggerElement],
  )

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: "button",
        className: cn(
          "flex h-7 shrink-0 cursor-pointer items-center justify-center px-2 hover:bg-accent",
          className,
        ),
        children,
        onClick: handleClick,
      },
      props,
    ),
    render,
    state: {
      slot: "selection-popover-trigger",
      open,
    },
  })
}

type SelectionPopoverShellProps = Omit<
  React.ComponentProps<"div">,
  "onDrag" | "onDragStart" | "ref"
> &
  ReturnType<typeof useSelectionPopoverLayout> & {
    ref?: React.Ref<HTMLDivElement>
  }

function SelectionPopoverShell({
  children,
  className,
  defaultLayout,
  handleDrag,
  handleDragStart,
  handleDragStop,
  handleResizeStop,
  handleWheel,
  isDragging: _isDragging,
  minHeight,
  minWidth,
  onMouseDown,
  onMouseUp,
  position,
  rndRef,
  ref: forwardedRef,
  style,
  ...props
}: SelectionPopoverShellProps) {
  const assignRndRef = React.useCallback(
    (instance: Rnd | null) => {
      rndRef.current = instance
      const element = instance?.getSelfElement() as HTMLDivElement | null

      if (typeof forwardedRef === "function") {
        forwardedRef(element)
        return
      }

      if (forwardedRef) {
        forwardedRef.current = element
      }
    },
    [forwardedRef, rndRef],
  )

  return (
    <Rnd
      ref={assignRndRef}
      bounds="window"
      default={defaultLayout}
      position={position}
      minWidth={minWidth}
      minHeight={minHeight}
      maxWidth="100vw"
      maxHeight="100vh"
      dragHandleClassName={SELECTION_POPOVER_DRAG_HANDLE_CLASS}
      cancel={SELECTION_POPOVER_NO_DRAG_SELECTOR}
      enableResizing={SELECTION_POPOVER_RESIZE_HANDLES}
      resizeHandleStyles={SELECTION_POPOVER_RESIZE_HANDLE_STYLES}
      onMouseDown={
        onMouseDown
          ? (e) => onMouseDown(e as unknown as React.MouseEvent<HTMLDivElement>)
          : undefined
      }
      onMouseUp={
        onMouseUp ? (e) => onMouseUp(e as unknown as React.MouseEvent<HTMLDivElement>) : undefined
      }
      {...props}
      className={cn(
        `pointer-events-auto flex flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-floating ${NOTRANSLATE_CLASS}`,
        className,
      )}
      {...{ [SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE]: "" }}
      style={{
        display: "flex",
        ...style,
        opacity: "var(--rf-selection-opacity, 1)",
        maxWidth: "100vw",
        maxHeight: "100vh",
      }}
      onDragStart={() => {
        handleDragStart()
      }}
      onDrag={(_, data) => {
        handleDrag({ x: data.x, y: data.y })
      }}
      onDragStop={(_, data) => {
        handleDragStop({ x: data.x, y: data.y })
      }}
      onResizeStop={(_, __, elementRef, ___, resizedPosition) => {
        handleResizeStop(elementRef, { x: resizedPosition.x, y: resizedPosition.y })
      }}
      onWheel={handleWheel}
    >
      {children}
    </Rnd>
  )
}

function SelectionPopoverContent({
  className,
  children,
  container,
  finalFocus,
  render,
  ...props
}: useRender.ComponentProps<"div"> &
  React.ComponentProps<"div"> & {
    container?: SelectionPopoverPortalContainer
    finalFocus?: DialogPrimitive.Popup.Props["finalFocus"]
  }) {
  const { open, setOpen, anchor, triggerElement } = useSelectionPopoverRootContext()
  // Tracked as state (not a ref) so listeners re-attach when Body remounts
  // while the popover stays open, e.g. a pinned popover reused for a new
  // selection session.
  const [bodyElement, setBodyElement] = React.useState<HTMLDivElement | null>(null)

  const {
    rndRef,
    isDragging,
    position,
    defaultLayout,
    minWidth,
    minHeight,
    handleDragStart,
    handleDrag,
    handleDragStop,
    handleResizeStop,
    handleWheel,
  } = useSelectionPopoverLayout({
    anchor,
    isVisible: open,
  })

  const handleClose = React.useCallback(() => {
    setOpen(false)
  }, [setOpen])

  usePreventScrollThrough({
    isEnabled: open,
    element: bodyElement,
  })

  const contentContextValue = React.useMemo(
    () => ({
      close: handleClose,
      isDragging,
      portalContainer: container ?? null,
      setBodyElement,
    }),
    [container, handleClose, isDragging, setBodyElement],
  )

  const shell = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn("flex h-full min-h-0 flex-1 flex-col", className),
        children: (
          <SelectionPopoverContentContext value={contentContextValue}>
            {children}
          </SelectionPopoverContentContext>
        ),
      },
      props,
    ),
    render,
    state: {
      slot: "selection-popover-content",
      open,
      dragging: isDragging,
    },
  })

  if (!anchor) {
    return null
  }

  const resolvedFinalFocus = finalFocus ?? (triggerElement ? { current: triggerElement } : false)

  return (
    <DialogPrimitive.Portal container={container}>
      <DialogPrimitive.Popup
        className={cn(
          "pointer-events-none fixed inset-0 focus:outline-none",
          SELECTION_CONTENT_OVERLAY_LAYERS.popover,
        )}
        finalFocus={resolvedFinalFocus}
      >
        <SelectionPopoverShell
          rndRef={rndRef}
          isDragging={isDragging}
          position={position}
          defaultLayout={defaultLayout}
          minWidth={minWidth}
          minHeight={minHeight}
          handleDragStart={handleDragStart}
          handleDrag={handleDrag}
          handleDragStop={handleDragStop}
          handleResizeStop={handleResizeStop}
          handleWheel={handleWheel}
        >
          {shell}
        </SelectionPopoverShell>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function SelectionPopoverHeader({
  children,
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> & React.ComponentProps<"div">) {
  const { isDragging } = useSelectionPopoverContentContext()

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          `${SELECTION_POPOVER_DRAG_HANDLE_CLASS} group relative flex items-center justify-between gap-3 px-4 py-2 select-none hover:cursor-grab active:cursor-grabbing`,
          className,
        ),
        children: (
          <>
            <div
              className={cn(
                "absolute top-0 left-1/2 -translate-x-1/2 p-1 transition-all duration-200",
                isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            >
              <IconGripHorizontal className="size-4" />
            </div>
            {children}
          </>
        ),
      },
      props,
    ),
    render,
    state: {
      slot: "selection-popover-header",
      dragging: isDragging,
    },
  })
}

function SelectionPopoverBody({
  className,
  render,
  ref: forwardedRef,
  ...props
}: useRender.ComponentProps<"div"> &
  React.ComponentProps<"div"> & {
    ref?: React.Ref<HTMLDivElement>
  }) {
  const { setBodyElement } = useSelectionPopoverContentContext()

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn("min-h-0 flex-1 overflow-y-auto", className),
      },
      props,
    ),
    ref: forwardedRef ? [forwardedRef, setBodyElement] : setBodyElement,
    render,
    state: {
      slot: "selection-popover-body",
    },
  })
}

function SelectionPopoverFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2 px-4 py-2", className)} {...props} />
}

function SelectionPopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <DialogPrimitive.Title className={cn("text-base font-semibold", className)} {...props} />
}

function SelectionPopoverDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-zinc-600 dark:text-zinc-400", className)}
      {...props}
    />
  )
}

function SelectionPopoverPin({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { pinned, setPinned } = useSelectionPopoverRootContext()
  const togglePinned = React.useCallback(() => {
    setPinned((prev) => !prev)
  }, [setPinned])
  const label = pinned ? "Unpin popover" : "Pin popover"

  return (
    <Button
      variant="ghost-secondary"
      size="icon-sm"
      className={className}
      onClick={togglePinned}
      aria-label={label}
      aria-pressed={pinned}
      title={label}
      data-rf-no-drag
      {...props}
    >
      {children ?? (
        <>
          {pinned ? <IconPinnedFilled /> : <IconPin />}
          <span className="sr-only">{label}</span>
        </>
      )}
    </Button>
  )
}

function SelectionPopoverClose({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <DialogPrimitive.Close
      render={
        <Button variant="ghost-secondary" size="icon-sm" className={className} data-rf-no-drag />
      }
      {...props}
    >
      {children ?? (
        <>
          <IconX />
          <span className="sr-only">Close</span>
        </>
      )}
    </DialogPrimitive.Close>
  )
}

const SelectionPopover = {
  Root: SelectionPopoverRoot,
  Trigger: SelectionPopoverTrigger,
  Content: SelectionPopoverContent,
  Header: SelectionPopoverHeader,
  Body: SelectionPopoverBody,
  Footer: SelectionPopoverFooter,
  Title: SelectionPopoverTitle,
  Description: SelectionPopoverDescription,
  Pin: SelectionPopoverPin,
  Close: SelectionPopoverClose,
} as const

export type { SelectionPopoverActions, SelectionPopoverPosition }

export {
  SelectionPopover,
  SelectionPopoverBody,
  SelectionPopoverClose,
  SelectionPopoverContent,
  SelectionPopoverDescription,
  SelectionPopoverFooter,
  SelectionPopoverHeader,
  SelectionPopoverPin,
  SelectionPopoverRoot,
  SelectionPopoverTitle,
  SelectionPopoverTrigger,
}
