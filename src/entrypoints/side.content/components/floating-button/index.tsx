import { browser, i18n } from "#imports"
import { IconSettings, IconX } from "@tabler/icons-react"
import { useAtom, useAtomValue } from "jotai"
import { useEffect, useRef, useState } from "react"
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
import { requestPageTranslationToggle } from "./request-page-translation-toggle"
import TranslateButton from "./translate-button"

const readFrogLogoUrl = new URL(readFrogLogo, browser.runtime.getURL("/")).href
const DRAG_THRESHOLD = 6
const DRAG_THRESHOLD_SQUARED = DRAG_THRESHOLD * DRAG_THRESHOLD
const LONG_PRESS_DURATION = 450

interface PointerInteraction {
  pointerId: number
  startX: number
  startY: number
  startPosition: number
  isDragging: boolean
  longPressTriggered: boolean
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
  const pointerInteractionRef = useRef<PointerInteraction | null>(null)
  const longPressTimerRef = useRef<number | null>(null)

  useEffect(() => {
    document.body.style.userSelect = isDraggingButton ? "none" : ""

    return () => {
      document.body.style.userSelect = ""
    }
  }, [isDraggingButton])

  // 拖拽结束时写入 storage
  useEffect(() => {
    if (!isDraggingButton && dragPosition !== null) {
      void setFloatingButton({ position: dragPosition })
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setDragPosition(null)
    }
  }, [isDraggingButton, dragPosition, setFloatingButton])

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current)
      }
    }
  }, [])

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const shouldOpenMenuByLongPress = (pointerType: string) => {
    if (pointerType === "touch") {
      return true
    }

    return typeof window.matchMedia === "function"
      && window.matchMedia("(pointer: coarse)").matches
  }

  const handlePrimaryAction = () => {
    if (floatingButton.clickAction === "translate") {
      const nextEnabled = !translationState.enabled
      void requestPageTranslationToggle(
        nextEnabled,
        nextEnabled
          ? createFeatureUsageContext(ANALYTICS_FEATURE.PAGE_TRANSLATION, ANALYTICS_SURFACE.FLOATING_BUTTON)
          : undefined,
      )
      return
    }

    setIsSideOpen(open => !open)
  }

  const finishPointerInteraction = (
    e: React.PointerEvent<HTMLDivElement>,
    shouldTriggerClick: boolean,
  ) => {
    const interaction = pointerInteractionRef.current
    if (!interaction || interaction.pointerId !== e.pointerId) {
      return
    }

    clearLongPressTimer()
    pointerInteractionRef.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)

    if (interaction.isDragging) {
      setIsDraggingButton(false)
      return
    }

    setIsDraggingButton(false)

    if (!shouldTriggerClick || interaction.longPressTriggered) {
      return
    }

    handlePrimaryAction()
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) {
      return
    }

    e.preventDefault()
    pointerInteractionRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPosition: dragPosition ?? floatingButton.position,
      isDragging: false,
      longPressTriggered: false,
    }

    e.currentTarget.setPointerCapture?.(e.pointerId)
    clearLongPressTimer()

    if (!shouldOpenMenuByLongPress(e.pointerType)) {
      return
    }

    longPressTimerRef.current = window.setTimeout(() => {
      const interaction = pointerInteractionRef.current
      if (!interaction || interaction.pointerId !== e.pointerId || interaction.isDragging) {
        return
      }

      interaction.longPressTriggered = true
      setIsDropdownOpen(true)
    }, LONG_PRESS_DURATION)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const interaction = pointerInteractionRef.current
    if (!interaction || interaction.pointerId !== e.pointerId) {
      return
    }

    const dx = e.clientX - interaction.startX
    const dy = e.clientY - interaction.startY

    if (!interaction.isDragging && dx * dx + dy * dy > DRAG_THRESHOLD_SQUARED) {
      interaction.isDragging = true
      clearLongPressTimer()
      setIsDraggingButton(true)

      if (interaction.longPressTriggered) {
        setIsDropdownOpen(false)
      }
    }

    if (!interaction.isDragging) {
      return
    }

    const initialY = interaction.startPosition * window.innerHeight
    const newY = Math.max(
      30,
      Math.min(
        window.innerHeight - 200,
        initialY + dy,
      ),
    )

    setDragPosition(newY / window.innerHeight)
  }

  const attachSideClassName = isDraggingButton || isSideOpen || isDropdownOpen ? "translate-x-0" : ""

  if (!floatingButton.enabled || floatingButton.disabledFloatingButtonPatterns.some(pattern => matchDomainPattern(window.location.href, pattern))) {
    return null
  }

  return (
    <div
      className="group fixed z-2147483647 flex flex-col items-end gap-2 print:hidden"
      style={{
        right: isSideOpen
          ? `calc(${sideContent.width}px + var(--removed-body-scroll-bar-size, 0px))`
          : "var(--removed-body-scroll-bar-size, 0px)",
        top: `${(dragPosition ?? floatingButton.position) * 100}vh`,
      }}
    >
      <TranslateButton className={attachSideClassName} />
      <div
        className={cn(
          "border-border flex h-10 w-15 items-center rounded-l-full border border-r-0 bg-white opacity-60 shadow-lg group-hover:opacity-100 dark:bg-neutral-900",
          "translate-x-5 transition-transform duration-300 group-hover:translate-x-0",
          (isSideOpen || isDropdownOpen) && "opacity-100",
          "touch-none",
          isDraggingButton ? "cursor-move" : "cursor-pointer",
          attachSideClassName,
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={e => finishPointerInteraction(e, true)}
        onPointerCancel={e => finishPointerInteraction(e, false)}
      >
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger
            render={(
              <button
                type="button"
                title="Close floating button"
                className={cn(
                  "border-border absolute -top-1 -left-1 hidden cursor-pointer rounded-full border bg-neutral-100 dark:bg-neutral-900",
                  "group-hover:block",
                  isDropdownOpen && "block",
                )}
                onPointerDown={e => e.stopPropagation()}
              />
            )}
          >
            <IconX className="h-3 w-3 text-neutral-400 dark:text-neutral-600" />
          </DropdownMenuTrigger>
          <DropdownMenuContent container={shadowWrapper} align="start" side="left" className="z-2147483647 w-fit! whitespace-nowrap">
            <DropdownMenuItem
              onPointerDown={e => e.stopPropagation()}
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
              onPointerDown={e => e.stopPropagation()}
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
          className="ml-[5px] h-8 w-8 rounded-full"
        />
      </div>
      <HiddenButton
        className={attachSideClassName}
        icon={<IconSettings className="h-5 w-5" />}
        onClick={() => {
          void sendMessage("openOptionsPage", undefined)
        }}
      />
    </div>
  )
}
