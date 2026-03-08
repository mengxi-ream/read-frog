import type { Config } from "@/types/config/config"
import { browser, i18n } from "#imports"
import { IconSettings, IconX } from "@tabler/icons-react"
import { useAtom, useAtomValue } from "jotai"
import { useCallback, useEffect, useRef, useState } from "react"
import readFrogLogo from "@/assets/icons/read-frog.png?url&no-inline"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { APP_NAME } from "@/utils/constants/app"
import { sendMessage } from "@/utils/message"
import { cn } from "@/utils/styles/utils"
import { matchDomainPattern } from "@/utils/url"
import { enablePageTranslationAtom, isDraggingButtonAtom, isSideOpenAtom } from "../../atoms"
import { shadowWrapper } from "../../index"
import HiddenButton from "./components/hidden-button"
import TranslateButton from "./translate-button"

const readFrogLogoUrl = new URL(readFrogLogo, browser.runtime.getURL("/")).href
const DRAG_THRESHOLD = 5
const DRAG_PREVIEW_SIZE = 44
const FLOATING_BUTTON_MIN_TOP = 30
const FLOATING_BUTTON_MAX_TOP_OFFSET = 200

type FloatingButtonAnchor = Config["floatingButton"]["anchor"]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export default function FloatingButton() {
  const [floatingButton, setFloatingButton] = useAtom(
    configFieldsAtomMap.floatingButton,
  )
  const sideContent = useAtomValue(configFieldsAtomMap.sideContent)
  const translationState = useAtomValue(enablePageTranslationAtom)
  const [isSideOpen, setIsSideOpen] = useAtom(isSideOpenAtom)
  const [isDraggingButton, setIsDraggingButton] = useAtom(isDraggingButtonAtom)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [dragPosition, setDragPosition] = useState<number | null>(null)
  const [dragAnchor, setDragAnchor] = useState<FloatingButtonAnchor | null>(null)
  const [dragPreview, setDragPreview] = useState<{ x: number, y: number } | null>(null)
  const dragMoveHandlerRef = useRef<((event: MouseEvent) => void) | null>(null)
  const dragUpHandlerRef = useRef<(() => void) | null>(null)

  const cleanupDragListeners = useCallback(() => {
    if (dragMoveHandlerRef.current) {
      document.removeEventListener("mousemove", dragMoveHandlerRef.current)
      dragMoveHandlerRef.current = null
    }

    if (dragUpHandlerRef.current) {
      document.removeEventListener("mouseup", dragUpHandlerRef.current)
      dragUpHandlerRef.current = null
    }

    document.body.style.userSelect = ""
    setIsDraggingButton(false)
  }, [setIsDraggingButton])

  useEffect(() => {
    return cleanupDragListeners
  }, [cleanupDragListeners])

  // 拖拽结束时写入 storage
  useEffect(() => {
    if (isDraggingButton) {
      return
    }

    if (dragPosition !== null && dragAnchor !== null) {
      void setFloatingButton({ position: dragPosition, anchor: dragAnchor })
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setDragPosition(null)
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setDragAnchor(null)
    }

    if (dragPreview !== null) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setDragPreview(null)
    }
  }, [dragAnchor, dragPosition, dragPreview, isDraggingButton, setFloatingButton])

  const handleButtonDragStart = (e: React.MouseEvent) => {
    if (isDropdownOpen) {
      return
    }

    const initialPointer = { x: e.clientX, y: e.clientY }
    const initialY = floatingButton.position * window.innerHeight
    let hasMoved = false // 标记是否发生了移动

    e.preventDefault()
    cleanupDragListeners()
    document.body.style.userSelect = "none"

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const moveDistance = Math.max(
        Math.abs(moveEvent.clientX - initialPointer.x),
        Math.abs(moveEvent.clientY - initialPointer.y),
      )
      if (moveDistance <= DRAG_THRESHOLD) {
        return
      }

      if (!hasMoved) {
        hasMoved = true
        setIsDraggingButton(true)
      }
      const maxTop = Math.max(
        FLOATING_BUTTON_MIN_TOP,
        window.innerHeight - FLOATING_BUTTON_MAX_TOP_OFFSET,
      )
      const newY = clamp(
        initialY + moveEvent.clientY - initialPointer.y,
        FLOATING_BUTTON_MIN_TOP,
        maxTop,
      )
      const newPosition = newY / window.innerHeight
      const availableWidth = window.innerWidth - (isSideOpen ? sideContent.width : 0)

      setDragPosition(newPosition)
      setDragAnchor(moveEvent.clientX < availableWidth / 2 ? "left" : "right")
      setDragPreview({
        x: clamp(
          moveEvent.clientX,
          DRAG_PREVIEW_SIZE / 2,
          window.innerWidth - DRAG_PREVIEW_SIZE / 2,
        ),
        y: clamp(
          moveEvent.clientY,
          DRAG_PREVIEW_SIZE / 2,
          window.innerHeight - DRAG_PREVIEW_SIZE / 2,
        ),
      })
    }

    const handleMouseUp = () => {
      cleanupDragListeners()

      if (!hasMoved) {
        if (floatingButton.clickAction === "translate") {
          const nextEnabled = !translationState.enabled
          void sendMessage("tryToSetEnablePageTranslationOnContentScript", {
            enabled: nextEnabled,
            analyticsContext: nextEnabled
              ? createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.FLOATING_BUTTON)
              : undefined,
          })
        }
        else {
          setIsSideOpen(o => !o)
        }
      }
    }

    dragMoveHandlerRef.current = handleMouseMove
    dragUpHandlerRef.current = handleMouseUp
    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("mousemove", handleMouseMove)
  }

  const currentAnchor = dragAnchor ?? floatingButton.anchor
  const currentPosition = dragPosition ?? floatingButton.position
  const attachSideClassName = isDraggingButton || isSideOpen || isDropdownOpen ? "translate-x-0" : ""
  const isLeftAnchor = currentAnchor === "left"

  if (!floatingButton.enabled || floatingButton.disabledFloatingButtonPatterns.some(pattern => matchDomainPattern(window.location.href, pattern))) {
    return null
  }

  return (
    <>
      <div
        className={cn(
          "group fixed z-2147483647 flex flex-col items-end gap-2 print:hidden",
          isLeftAnchor ? "items-start" : "items-end",
          isDraggingButton && "pointer-events-none opacity-0",
        )}
        style={{
          left: isLeftAnchor ? "0px" : "auto",
          right: isLeftAnchor
            ? "auto"
            : isSideOpen
              ? `calc(${sideContent.width}px + var(--removed-body-scroll-bar-size, 0px))`
              : "var(--removed-body-scroll-bar-size, 0px)",
          top: `${currentPosition * 100}vh`,
        }}
      >
        <TranslateButton side={currentAnchor} className={attachSideClassName} />
        <div
          className={cn(
            "border-border flex h-10 w-15 items-center border bg-white opacity-60 shadow-lg group-hover:opacity-100 dark:bg-neutral-900",
            isLeftAnchor ? "justify-end rounded-r-full border-l-0 -translate-x-5" : "justify-start rounded-l-full border-r-0 translate-x-5",
            "transition-transform duration-300 group-hover:translate-x-0",
            (isSideOpen || isDropdownOpen) && "opacity-100",
            isDraggingButton ? "cursor-move" : "cursor-pointer",
            attachSideClassName,
          )}
          onMouseDown={handleButtonDragStart}
        >
          <DropdownMenu modal={false} open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <DropdownMenuTrigger
              render={(
                <button
                  type="button"
                  title="Close floating button"
                  className={cn(
                    "border-border absolute -top-1 cursor-pointer rounded-full border bg-neutral-100 opacity-0 pointer-events-none dark:bg-neutral-900",
                    isLeftAnchor ? "-right-1" : "-left-1",
                    "group-hover:opacity-100 group-hover:pointer-events-auto",
                    isDropdownOpen && "opacity-100 pointer-events-auto",
                  )}
                  onMouseDown={e => e.stopPropagation()} // 父级不会收到 mousedown
                />
              )}
            >
              <IconX className="h-3 w-3 text-neutral-400 dark:text-neutral-600" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              container={shadowWrapper}
              align="start"
              side={isLeftAnchor ? "right" : "left"}
              positionerClassName="z-2147483647"
              className="z-2147483647 w-fit! whitespace-nowrap"
            >
              <DropdownMenuItem
                onMouseDown={e => e.stopPropagation()}
                onClick={() => {
                  const currentDomain = window.location.hostname
                  const currentPatterns = floatingButton.disabledFloatingButtonPatterns || []
                  void setFloatingButton({
                    ...floatingButton,
                    disabledFloatingButtonPatterns: [...currentPatterns, currentDomain],
                  })
                }}
              >
                {i18n.t("options.floatingButtonAndToolbar.floatingButton.closeMenu.disableForSite")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onMouseDown={e => e.stopPropagation()}
                onClick={() => {
                  void setFloatingButton({ ...floatingButton, enabled: false })
                }}
              >
                {i18n.t("options.floatingButtonAndToolbar.floatingButton.closeMenu.disableGlobally")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <img
            src={readFrogLogoUrl}
            alt={APP_NAME}
            className={cn("h-8 w-8 rounded-full", isLeftAnchor ? "mr-[5px]" : "ml-[5px]")}
          />
        </div>
        <HiddenButton
          side={currentAnchor}
          className={attachSideClassName}
          icon={<IconSettings className="h-5 w-5" />}
          onClick={() => {
            void sendMessage("openOptionsPage", undefined)
          }}
        />
      </div>
      {isDraggingButton && dragPreview && (
        <div
          aria-hidden="true"
          className="fixed z-2147483647 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-white dark:bg-neutral-900 print:hidden cursor-move"
          style={{
            left: `${dragPreview.x}px`,
            top: `${dragPreview.y}px`,
          }}
        >
          <img
            src={readFrogLogoUrl}
            alt=""
            draggable={false}
            className="size-8 rounded-full select-none"
          />
        </div>
      )}
    </>
  )
}
