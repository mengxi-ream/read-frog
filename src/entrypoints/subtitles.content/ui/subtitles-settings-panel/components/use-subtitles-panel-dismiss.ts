import type { RefObject } from "react"
import { useEffect, useEffectEvent } from "react"
import { TRANSLATE_BUTTON_CLASS, TRANSLATE_BUTTON_CONTAINER_ID } from "@/utils/constants/subtitles"

function isElement(value: EventTarget | null): value is Element {
  return value instanceof Element
}

/**
 * Popups that belong to the panel but are portalled out of it.
 *
 * They mount at the shadow container's root so they aren't clipped by the panel's
 * `overflow-hidden`, which also puts them outside `panelRef` — a press inside one is
 * indistinguishable from a press on the page unless it is listed here. Miss an entry and the
 * symptom is the whole panel vanishing the moment you touch that popup.
 *
 * Add a `data-slot` to any new portalled popup and list it here.
 */
const PORTALLED_PANEL_POPUP_SELECTOR = [
  "[data-slot='select-content']",
  "[data-slot='color-picker-content']",
  "[data-slot='color-picker-format-content']",
].join(",")

function isTranslateTriggerTarget(path: EventTarget[]) {
  return path.some(
    (target) =>
      isElement(target) &&
      (target.id === TRANSLATE_BUTTON_CONTAINER_ID ||
        target.classList.contains(TRANSLATE_BUTTON_CLASS)),
  )
}

interface UseSubtitlesPanelDismissOptions {
  enabled: boolean
  onClose: () => void
  panelRef: RefObject<HTMLElement | null>
}

export function useSubtitlesPanelDismiss({
  enabled,
  onClose,
  panelRef,
}: UseSubtitlesPanelDismissOptions) {
  const onPointerDown = useEffectEvent((event: PointerEvent) => {
    if (!enabled) {
      return
    }

    const path = event.composedPath()
    const clickedInsidePanel = !!panelRef.current && path.includes(panelRef.current)
    const clickedTrigger = isTranslateTriggerTarget(path)
    const clickedPanelPopup = path.some(
      (target) => isElement(target) && target.matches(PORTALLED_PANEL_POPUP_SELECTOR),
    )

    if (clickedInsidePanel || clickedTrigger || clickedPanelPopup) {
      return
    }

    onClose()
  })

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!enabled) {
      return
    }

    if (event.key === "Escape") {
      onClose()
    }
  })

  useEffect(() => {
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKeyDown, true)

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown, true)
    }
  }, [])
}
