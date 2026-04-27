import type { FloatingButtonSide } from "@/types/config/floating-button"
import { browser, i18n } from "#imports"
import { IconLock, IconLockOpen, IconSettings, IconX } from "@tabler/icons-react"
import { useAtom, useAtomValue } from "jotai"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
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
import { enablePageTranslationAtom, isDraggingButtonAtom } from "../../atoms"
import { shadowWrapper } from "../../index"
import HiddenButton from "./components/hidden-button"
import TranslateButton from "./translate-button"

const readFrogLogoUrl = new URL(readFrogLogo, browser.runtime.getURL("/")).href
const LONG_PRESS_DELAY_MS = 350
const DRAG_START_DISTANCE_PX = 6
const MIN_FLOATING_CONTAINER_TOP_PX = 30
const FLOATING_CONTAINER_BOTTOM_CLEARANCE_PX = 200

interface DragPoint {
  x: number
  y: number
}

interface PendingDragState {
  pointerId: number
  startClientX: number
  startClientY: number
  currentClientX: number
  currentClientY: number
  pointerOffsetX: number
  pointerOffsetY: number
  mainOffsetY: number
  buttonWidth: number
  buttonHeight: number
  hasActiveDrag: boolean
  longPressTimerId: number
}

const floatingButtonControlClassName = cn(
  "absolute invisible cursor-pointer pointer-events-none flex size-6 items-center justify-center",
  "text-neutral-300 transition-[color,left,right,transform] duration-300 hover:scale-110 hover:text-neutral-500 active:scale-90 active:text-neutral-500",
  "dark:text-neutral-700 dark:hover:text-neutral-500 dark:active:text-neutral-500",
)
const floatingButtonControlOffsetClassNames = {
  right: {
    collapsed: "left-0",
    expanded: "-left-6",
  },
  left: {
    collapsed: "right-0",
    expanded: "-right-6",
  },
} satisfies Record<FloatingButtonSide, { collapsed: string, expanded: string }>

function FirefoxSidebarHelpToast() {
  return (
    <span>
      {i18n.t("sidePanel.firefoxUserActionHint")}
      {" "}
      <a
        href={i18n.t("sidePanel.firefoxUserActionHelpUrl")}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2"
      >
        {i18n.t("sidePanel.firefoxUserActionHelpText")}
      </a>
    </span>
  )
}

function getFloatingButtonSide(side: string | undefined): FloatingButtonSide {
  return side === "left" ? "left" : "right"
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getPointerDistance(startX: number, startY: number, currentX: number, currentY: number) {
  return Math.hypot(currentX - startX, currentY - startY)
}

function getDragPreviewPosition(pendingDrag: PendingDragState): DragPoint {
  return {
    x: clamp(
      pendingDrag.currentClientX - pendingDrag.pointerOffsetX,
      0,
      Math.max(0, window.innerWidth - pendingDrag.buttonWidth),
    ),
    y: clamp(
      pendingDrag.currentClientY - pendingDrag.pointerOffsetY,
      0,
      Math.max(0, window.innerHeight - pendingDrag.buttonHeight),
    ),
  }
}

function getNormalizedFloatingContainerTop(mainButtonTop: number, mainOffsetY: number) {
  const viewportHeight = Math.max(1, window.innerHeight)
  const maxTop = Math.max(
    MIN_FLOATING_CONTAINER_TOP_PX,
    viewportHeight - FLOATING_CONTAINER_BOTTOM_CLEARANCE_PX,
  )
  const containerTop = clamp(
    mainButtonTop - mainOffsetY,
    MIN_FLOATING_CONTAINER_TOP_PX,
    maxTop,
  )
  return containerTop / viewportHeight
}

export default function FloatingButton() {
  const [floatingButton, setFloatingButton] = useAtom(
    configFieldsAtomMap.floatingButton,
  )
  const translationState = useAtomValue(enablePageTranslationAtom)
  const [isDraggingButton, setIsDraggingButton] = useAtom(isDraggingButtonAtom)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isHitAreaExpanded, setIsHitAreaExpanded] = useState(false)
  const [dragPreviewPosition, setDragPreviewPosition] = useState<DragPoint | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mainButtonRef = useRef<HTMLDivElement | null>(null)
  const pendingDragRef = useRef<PendingDragState | null>(null)
  const lastDragPreviewRef = useRef<DragPoint | null>(null)
  const isFloatingButtonLocked = floatingButton.locked
  const floatingButtonSide = getFloatingButtonSide(floatingButton.side)
  const isFloatingButtonExpanded = isHitAreaExpanded || isDropdownOpen
  const isMainButtonAttached = isFloatingButtonLocked || isFloatingButtonExpanded

  useEffect(() => {
    if (!isDraggingButton)
      return

    const previousUserSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor
    document.body.style.userSelect = "none"
    document.body.style.cursor = "grabbing"

    return () => {
      document.body.style.userSelect = previousUserSelect
      document.body.style.cursor = previousCursor
    }
  }, [isDraggingButton])

  useEffect(() => {
    return () => {
      const pendingDrag = pendingDragRef.current
      if (pendingDrag) {
        window.clearTimeout(pendingDrag.longPressTimerId)
      }
    }
  }, [])

  const handleFloatingButtonClick = () => {
    if (floatingButton.clickAction === "translate") {
      const nextEnabled = !translationState.enabled
      void sendMessage("tryToSetEnablePageTranslationOnContentScript", {
        enabled: nextEnabled,
        analyticsContext: nextEnabled
          ? createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.FLOATING_BUTTON)
          : undefined,
      })
      return
    }

    void Promise.resolve(sendMessage("toggleSidePanel", undefined)).then((result) => {
      if (result?.ok === false && result.reason === "requires-extension-user-action") {
        toast.info(<FirefoxSidebarHelpToast />)
      }
    })
  }

  const startActiveDrag = () => {
    const pendingDrag = pendingDragRef.current
    if (!pendingDrag || pendingDrag.hasActiveDrag)
      return

    pendingDrag.hasActiveDrag = true
    const nextPreviewPosition = getDragPreviewPosition(pendingDrag)
    lastDragPreviewRef.current = nextPreviewPosition
    setDragPreviewPosition(nextPreviewPosition)
    setIsHitAreaExpanded(false)
    setIsDropdownOpen(false)
    setIsDraggingButton(true)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0)
      return

    const mainButton = mainButtonRef.current ?? e.currentTarget
    const mainButtonRect = mainButton.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    const mainOffsetY = containerRect
      ? mainButtonRect.top - containerRect.top
      : 0

    e.preventDefault()
    if (typeof e.currentTarget.setPointerCapture === "function") {
      e.currentTarget.setPointerCapture(e.pointerId)
    }

    pendingDragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      currentClientX: e.clientX,
      currentClientY: e.clientY,
      pointerOffsetX: e.clientX - mainButtonRect.left,
      pointerOffsetY: e.clientY - mainButtonRect.top,
      mainOffsetY,
      buttonWidth: mainButtonRect.width || 40,
      buttonHeight: mainButtonRect.height || 40,
      hasActiveDrag: false,
      longPressTimerId: window.setTimeout(startActiveDrag, LONG_PRESS_DELAY_MS),
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pendingDrag = pendingDragRef.current
    if (!pendingDrag || pendingDrag.pointerId !== e.pointerId)
      return

    pendingDrag.currentClientX = e.clientX
    pendingDrag.currentClientY = e.clientY

    if (!pendingDrag.hasActiveDrag) {
      const pointerDistance = getPointerDistance(
        pendingDrag.startClientX,
        pendingDrag.startClientY,
        e.clientX,
        e.clientY,
      )
      if (pointerDistance > DRAG_START_DISTANCE_PX) {
        startActiveDrag()
      }
    }

    if (pendingDrag.hasActiveDrag) {
      const nextPreviewPosition = getDragPreviewPosition(pendingDrag)
      lastDragPreviewRef.current = nextPreviewPosition
      setDragPreviewPosition(nextPreviewPosition)
    }
  }

  const finishPointerInteraction = (
    e: React.PointerEvent<HTMLDivElement>,
    shouldTriggerClick: boolean,
  ) => {
    const pendingDrag = pendingDragRef.current
    if (!pendingDrag || pendingDrag.pointerId !== e.pointerId)
      return

    window.clearTimeout(pendingDrag.longPressTimerId)
    pendingDragRef.current = null

    if (typeof e.currentTarget.releasePointerCapture === "function") {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }

    if (pendingDrag.hasActiveDrag) {
      const finalPreviewPosition = lastDragPreviewRef.current
        ?? getDragPreviewPosition(pendingDrag)
      const finalCenterX = finalPreviewPosition.x + pendingDrag.buttonWidth / 2
      const nextSide: FloatingButtonSide = finalCenterX < window.innerWidth / 2
        ? "left"
        : "right"
      const nextPosition = getNormalizedFloatingContainerTop(
        finalPreviewPosition.y,
        pendingDrag.mainOffsetY,
      )

      lastDragPreviewRef.current = null
      setDragPreviewPosition(null)
      void setFloatingButton({ position: nextPosition, side: nextSide })
      setIsDraggingButton(false)
      return
    }

    lastDragPreviewRef.current = null
    setDragPreviewPosition(null)
    setIsDraggingButton(false)

    if (shouldTriggerClick) {
      handleFloatingButtonClick()
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    finishPointerInteraction(e, true)
  }

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    finishPointerInteraction(e, false)
  }

  const handleMouseEnter = () => {
    if (!isDraggingButton) {
      setIsHitAreaExpanded(true)
    }
  }

  const handleMouseLeave = () => {
    if (!isDropdownOpen && !isDraggingButton) {
      setIsHitAreaExpanded(false)
    }
  }

  if (!floatingButton.enabled || floatingButton.disabledFloatingButtonPatterns.some(pattern => matchDomainPattern(window.location.href, pattern))) {
    return null
  }

  const containerStyle: React.CSSProperties = isDraggingButton && dragPreviewPosition
    ? {
        left: `${dragPreviewPosition.x}px`,
        right: "auto",
        top: `${dragPreviewPosition.y}px`,
      }
    : {
        left: floatingButtonSide === "left" ? "0px" : undefined,
        right: floatingButtonSide === "right"
          ? "var(--removed-body-scroll-bar-size, 0px)"
          : undefined,
        top: `${floatingButton.position * 100}vh`,
      }

  return (
    <div
      ref={containerRef}
      data-testid="floating-button-container"
      className={cn(
        "fixed z-2147483647 flex flex-col gap-2 print:hidden",
        isDraggingButton
          ? "items-center"
          : floatingButtonSide === "right" ? "items-end" : "items-start",
        !isDraggingButton && isFloatingButtonExpanded && (
          floatingButtonSide === "right" ? "pl-6" : "pr-6"
        ),
      )}
      style={containerStyle}
      onMouseLeave={handleMouseLeave}
    >
      {!isDraggingButton && (
        <TranslateButton
          side={floatingButtonSide}
          expanded={isFloatingButtonExpanded}
        />
      )}
      <div className="relative">
        <div
          ref={mainButtonRef}
          data-testid="floating-main-button"
          className={cn(
            "border-border relative flex h-10 items-center bg-white shadow-lg transition-transform duration-300 dark:bg-neutral-900",
            isDraggingButton
              ? "w-10 touch-none justify-center rounded-full border cursor-grabbing opacity-100"
              : floatingButtonSide === "right"
                ? "w-11 justify-start rounded-l-full border border-r-0"
                : "w-11 justify-end rounded-r-full border border-l-0",
            !isDraggingButton && (isMainButtonAttached
              ? "translate-x-0"
              : floatingButtonSide === "right" ? "translate-x-6" : "-translate-x-6"),
            !isDraggingButton && (isFloatingButtonExpanded ? "opacity-100" : "opacity-60"),
            !isDraggingButton && "cursor-pointer",
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onMouseEnter={handleMouseEnter}
        >
          <img
            src={readFrogLogoUrl}
            alt={APP_NAME}
            className={cn(
              "h-8 w-8 rounded-full",
              !isDraggingButton && (floatingButtonSide === "right" ? "ml-1" : "mr-1"),
            )}
          />
        </div>

        {!isDraggingButton && (
          <>
            <FloatingButtonCloseMenu
              expanded={isFloatingButtonExpanded}
              side={floatingButtonSide}
              onDropdownOpenChange={setIsDropdownOpen}
            />
            <FloatingButtonLockControl
              expanded={isFloatingButtonExpanded}
              side={floatingButtonSide}
            />
          </>
        )}
      </div>
      {!isDraggingButton && (
        <HiddenButton
          side={floatingButtonSide}
          expanded={isFloatingButtonExpanded}
          icon={<IconSettings className="h-5 w-5" />}
          onClick={() => {
            void sendMessage("openOptionsPage", undefined)
          }}
        />
      )}
    </div>
  )
}

interface FloatingButtonCloseMenuProps {
  expanded: boolean
  side: FloatingButtonSide
  onDropdownOpenChange: (open: boolean) => void
}

function FloatingButtonCloseMenu({
  expanded,
  side,
  onDropdownOpenChange,
}: FloatingButtonCloseMenuProps) {
  const [floatingButton, setFloatingButton] = useAtom(configFieldsAtomMap.floatingButton)
  const [open, setOpen] = useState(false)
  const controlOffsetClassName = !floatingButton.locked && !expanded
    ? floatingButtonControlOffsetClassNames[side].collapsed
    : floatingButtonControlOffsetClassNames[side].expanded

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    onDropdownOpenChange(nextOpen)
  }

  const handleDisableForSite = () => {
    const currentDomain = window.location.hostname
    const currentPatterns = floatingButton.disabledFloatingButtonPatterns || []

    void setFloatingButton({
      ...floatingButton,
      disabledFloatingButtonPatterns: [...currentPatterns, currentDomain],
    })
  }

  const handleDisableGlobally = () => {
    void setFloatingButton({ ...floatingButton, enabled: false })
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={(
          <button
            type="button"
            aria-label="Close floating button"
            className={cn(
              floatingButtonControlClassName,
              "-top-1",
              controlOffsetClassName,
              expanded && "visible pointer-events-auto",
              open && "visible pointer-events-auto",
            )}
          />
        )}
      >
        <IconX className="h-3 w-3" strokeWidth={3} />
      </DropdownMenuTrigger>
      <DropdownMenuContent container={shadowWrapper} align="start" side={side === "right" ? "left" : "right"} className="z-2147483647 w-fit! whitespace-nowrap">
        <DropdownMenuItem
          onMouseDown={e => e.stopPropagation()}
          onClick={handleDisableForSite}
        >
          {i18n.t("options.floatingButtonAndToolbar.floatingButton.closeMenu.disableForSite")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onMouseDown={e => e.stopPropagation()}
          onClick={handleDisableGlobally}
        >
          {i18n.t("options.floatingButtonAndToolbar.floatingButton.closeMenu.disableGlobally")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface FloatingButtonLockControlProps {
  expanded: boolean
  side: FloatingButtonSide
}

function FloatingButtonLockControl({ expanded, side }: FloatingButtonLockControlProps) {
  const [floatingButton, setFloatingButton] = useAtom(configFieldsAtomMap.floatingButton)
  const locked = floatingButton.locked
  const controlOffsetClassName = !locked && !expanded
    ? floatingButtonControlOffsetClassNames[side].collapsed
    : floatingButtonControlOffsetClassNames[side].expanded

  const handleToggleLocked = () => {
    void setFloatingButton({ ...floatingButton, locked: !locked })
  }

  return (
    <button
      type="button"
      aria-label={locked ? "Unlock floating button" : "Lock floating button"}
      className={cn(
        floatingButtonControlClassName,
        "-bottom-1",
        controlOffsetClassName,
        expanded && "visible pointer-events-auto",
      )}
      onClick={handleToggleLocked}
    >
      {locked
        ? <IconLock className="h-3 w-3" strokeWidth={3} />
        : <IconLockOpen className="h-3 w-3" strokeWidth={3} />}
    </button>
  )
}
