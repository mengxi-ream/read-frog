import { useAtomValue } from "jotai"
import { useCallback, useImperativeHandle, useRef } from "react"
import { Rnd } from "react-rnd"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import { mouseClickPositionAtom, selectionContentAtom } from "../atom"
import { PopoverHeader } from "./popover-header"
import { useDismissOnOutsideMousedown } from "./use-dismiss-on-outside-mousedown"
import {
  POPOVER_DRAG_HANDLE_CLASS,
  POPOVER_NO_DRAG_SELECTOR,
  POPOVER_RESIZE_HANDLE_STYLES,
  POPOVER_RESIZE_HANDLES,
  usePopoverLayout,
} from "./use-popover-layout"
import { usePreventScrollThrough } from "./use-prevent-scroll-through"

interface PopoverWrapperProps {
  title: string
  icon: React.ReactNode | string
  children: React.ReactNode
  onClose?: () => void
  isVisible: boolean
  setIsVisible: (isVisible: boolean) => void
  ref?: React.Ref<PopoverWrapperRef>
}

export interface PopoverWrapperRef {
  scrollToBottom: () => void
}

export function PopoverWrapper({ title, icon, children, onClose, isVisible, setIsVisible, ref }: PopoverWrapperProps) {
  const mouseClickPosition = useAtomValue(mouseClickPositionAtom)
  const selectionContent = useAtomValue(selectionContentAtom)
  const contentRef = useRef<HTMLDivElement>(null)
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
  } = usePopoverLayout({
    anchor: mouseClickPosition,
    isVisible,
  })

  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      requestAnimationFrame(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = contentRef.current.scrollHeight
        }
      })
    },
  }), [])

  const handleClose = useCallback(() => {
    setIsVisible(false)
    onClose?.()
  }, [setIsVisible, onClose])

  useDismissOnOutsideMousedown({
    isEnabled: isVisible,
    getElement: () => rndRef.current?.getSelfElement() ?? null,
    onDismiss: handleClose,
  })

  usePreventScrollThrough({
    isEnabled: isVisible,
    elementRef: contentRef,
  })

  if (!isVisible || !mouseClickPosition || !selectionContent) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[2147483647] pointer-events-none"
    >
      <Rnd
        ref={rndRef}
        bounds="parent"
        default={defaultLayout}
        minWidth={minWidth}
        minHeight={minHeight}
        maxWidth="100vw"
        maxHeight="100vh"
        dragHandleClassName={POPOVER_DRAG_HANDLE_CLASS}
        cancel={POPOVER_NO_DRAG_SELECTOR}
        enableResizing={POPOVER_RESIZE_HANDLES}
        resizeHandleStyles={POPOVER_RESIZE_HANDLE_STYLES}
        className={`pointer-events-auto overflow-hidden rounded-lg border bg-white shadow-lg dark:bg-zinc-800 flex flex-col ${NOTRANSLATE_CLASS}`}
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
        <PopoverHeader
          title={title}
          icon={icon}
          isDragging={isDragging}
          onClose={handleClose}
        />
        <div
          ref={contentRef}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          {children}
        </div>
      </Rnd>
    </div>
  )
}
