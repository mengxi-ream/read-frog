"use client"

import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { IconGripHorizontal, IconPin, IconPinnedFilled, IconX } from "@tabler/icons-react"
import * as React from "react"
import { createPortal } from "react-dom"
import { Rnd } from "react-rnd"
import { Button } from "@/components/ui/base-ui/button"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import { cn } from "@/utils/styles/utils"
import { useDismissOnOutsideMousedown } from "./use-dismiss-on-outside-mousedown"
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

interface SelectionPopoverRootContextValue {
  open: boolean
  setOpen: (value: boolean | ((value: boolean) => boolean)) => void
  anchor: SelectionPopoverPosition | null
  setAnchor: (value: SelectionPopoverPosition | null) => void
  pinned: boolean
  setPinned: React.Dispatch<React.SetStateAction<boolean>>
}

interface SelectionPopoverContentContextValue {
  close: () => void
  isDragging: boolean
  pinned: boolean
  togglePinned: () => void
  setBodyElement: (node: HTMLDivElement | null) => void
}

const SelectionPopoverRootContext = React.createContext<SelectionPopoverRootContextValue | null>(null)
const SelectionPopoverContentContext = React.createContext<SelectionPopoverContentContextValue | null>(null)
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

function SelectionPopoverRoot({
  children,
  defaultOpen = false,
  open: openProp,
  onOpenChange,
}: {
  children: React.ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const instanceId = React.useId()
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const [anchor, setAnchor] = React.useState<SelectionPopoverPosition | null>(null)
  const [pinned, setPinned] = React.useState(false)
  const open = openProp ?? uncontrolledOpen

  const setOpen = React.useCallback((value: boolean | ((value: boolean) => boolean)) => {
    const nextOpen = typeof value === "function" ? value(open) : value

    if (!nextOpen) {
      setPinned(false)
    }

    if (openProp === undefined) {
      setUncontrolledOpen(nextOpen)
    }

    onOpenChange?.(nextOpen)
  }, [onOpenChange, open, openProp])

  React.useEffect(() => {
    if (!open) {
      return
    }

    const handlePeerPopoverOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{ instanceId?: string }>
      if (customEvent.detail?.instanceId && customEvent.detail.instanceId !== instanceId) {
        setOpen(false)
      }
    }

    window.addEventListener(SELECTION_POPOVER_OPEN_EVENT, handlePeerPopoverOpen)
    window.dispatchEvent(new CustomEvent(SELECTION_POPOVER_OPEN_EVENT, {
      detail: { instanceId },
    }))

    return () => {
      window.removeEventListener(SELECTION_POPOVER_OPEN_EVENT, handlePeerPopoverOpen)
    }
  }, [instanceId, open, setOpen])

  const contextValue = React.useMemo(() => ({
    open,
    setOpen,
    anchor,
    setAnchor,
    pinned,
    setPinned,
  }), [anchor, open, pinned, setOpen])

  return (
    <SelectionPopoverRootContext value={contextValue}>
      {children}
    </SelectionPopoverRootContext>
  )
}

function SelectionPopoverTrigger({
  className,
  children,
  render,
  ...props
}: useRender.ComponentProps<"button"> & React.ComponentProps<"button">) {
  const { setOpen, setAnchor, setPinned } = useSelectionPopoverRootContext()

  const handleClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setPinned(false)
    setAnchor({ x: rect.left, y: rect.top })
    setOpen(true)
  }, [setAnchor, setOpen, setPinned])

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: "button",
        className: cn("px-2 h-7 shrink-0 flex items-center justify-center hover:bg-accent cursor-pointer", className),
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

function SelectionPopoverContent({
  className,
  children,
  container,
  render,
  ...props
}: useRender.ComponentProps<"div"> & React.ComponentProps<"div"> & {
  container?: Element | ShadowRoot | DocumentFragment | null
}) {
  const { open, setOpen, anchor, pinned, setPinned } = useSelectionPopoverRootContext()
  const bodyElementRef = React.useRef<HTMLDivElement | null>(null)
  const setBodyElement = React.useCallback((node: HTMLDivElement | null) => {
    bodyElementRef.current = node
  }, [])
  const togglePinned = React.useCallback(() => {
    setPinned(prev => !prev)
  }, [setPinned])

  const {
    rndRef,
    isDragging,
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

  useDismissOnOutsideMousedown({
    isEnabled: open && !pinned,
    getElement: () => rndRef.current?.getSelfElement() ?? null,
    onDismiss: handleClose,
  })

  usePreventScrollThrough({
    isEnabled: open,
    elementRef: bodyElementRef,
  })

  const contentContextValue = React.useMemo(() => ({
    close: handleClose,
    isDragging,
    pinned,
    togglePinned,
    setBodyElement,
  }), [handleClose, isDragging, pinned, setBodyElement, togglePinned])

  const shell = useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "flex min-h-0 h-full flex-1 flex-col",
          className,
        ),
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

  if (!open || !anchor) {
    return null
  }

  const floatingContent = (
    <div className="fixed inset-0 z-2147483647 pointer-events-none">
      <Rnd
        ref={rndRef}
        bounds="parent"
        default={defaultLayout}
        minWidth={minWidth}
        minHeight={minHeight}
        maxWidth="100vw"
        maxHeight="100vh"
        dragHandleClassName={SELECTION_POPOVER_DRAG_HANDLE_CLASS}
        cancel={SELECTION_POPOVER_NO_DRAG_SELECTOR}
        enableResizing={SELECTION_POPOVER_RESIZE_HANDLES}
        resizeHandleStyles={SELECTION_POPOVER_RESIZE_HANDLE_STYLES}
        className={`pointer-events-auto flex flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-floating ${NOTRANSLATE_CLASS}`}
        style={{
          display: "flex",
          maxWidth: "100vw",
          maxHeight: "100vh",
        }}
        onDragStart={handleDragStart}
        onDrag={(_, data) => {
          handleDrag({ x: data.x, y: data.y })
        }}
        onDragStop={(_, data) => {
          handleDragStop({ x: data.x, y: data.y })
        }}
        onResizeStop={(_, __, elementRef, ___, position) => {
          handleResizeStop(elementRef, { x: position.x, y: position.y })
        }}
        onWheel={handleWheel}
      >
        {shell}
      </Rnd>
    </div>
  )

  if (!container) {
    return floatingContent
  }

  return createPortal(floatingContent, container)
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
          `${SELECTION_POPOVER_DRAG_HANDLE_CLASS} group relative flex items-center justify-between gap-3 py-2 px-4 select-none hover:cursor-grab active:cursor-grabbing`,
          className,
        ),
        children: (
          <>
            <div
              className={cn(
                "absolute left-1/2 top-0 -translate-x-1/2 p-1 transition-all duration-200",
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
}: useRender.ComponentProps<"div"> & React.ComponentProps<"div"> & {
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

function SelectionPopoverFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2 p-4", className)}
      {...props}
    />
  )
}

function SelectionPopoverTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-base font-semibold", className)}
      {...props}
    />
  )
}

function SelectionPopoverDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
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
  const { pinned, togglePinned } = useSelectionPopoverContentContext()
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
  const { close } = useSelectionPopoverContentContext()

  return (
    <Button
      variant="ghost-secondary"
      size="icon-sm"
      className={className}
      onClick={close}
      data-rf-no-drag
      {...props}
    >
      {children ?? (
        <>
          <IconX />
          <span className="sr-only">Close</span>
        </>
      )}
    </Button>
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
