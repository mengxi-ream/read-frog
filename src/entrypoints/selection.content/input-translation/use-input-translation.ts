import { useAtom } from "jotai"
import { useCallback, useEffect, useRef } from "react"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext, trackFeatureAttempt } from "@/utils/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { translateTextForInput } from "@/utils/host/translate/translate-variants"

const SPACE_KEY = " "
const TRIGGER_COUNT = 3
const LAST_CYCLE_SWAPPED_KEY = "read-frog-input-translation-last-cycle-swapped"
const SPINNER_ID = "read-frog-input-translation-spinner"

function getLastCycleSwapped(): boolean {
  try {
    return sessionStorage.getItem(LAST_CYCLE_SWAPPED_KEY) === "true"
  }
  catch {
    return false
  }
}

function setLastCycleSwapped(swapped: boolean): void {
  try {
    sessionStorage.setItem(LAST_CYCLE_SWAPPED_KEY, String(swapped))
  }
  catch {
  }
}

function showSpinner(element: HTMLElement): () => void {
  const existingSpinner = document.getElementById(SPINNER_ID)
  if (existingSpinner)
    existingSpinner.remove()

  const spinner = document.createElement("span")
  spinner.id = SPINNER_ID
  spinner.style.cssText = `
    position: absolute !important;
    display: inline-block !important;
    width: 10px !important;
    height: 10px !important;
    border: 3px solid #e5e5e5 !important;
    border-top: 3px solid #4ade80 !important;
    border-radius: 50% !important;
    box-sizing: content-box !important;
    z-index: 999999 !important;
    pointer-events: none !important;
  `

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

  if (!prefersReducedMotion) {
    spinner.animate(
      [
        { transform: "rotate(0deg)" },
        { transform: "rotate(360deg)" },
      ],
      {
        duration: 600,
        iterations: Infinity,
        easing: "linear",
      },
    )
  }
  else {
    spinner.style.borderTopColor = "#a3a3a3"
  }

  const updatePosition = () => {
    if (!element.isConnected)
      return

    const rect = element.getBoundingClientRect()
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const spinnerSize = 16
    const top = rect.top + scrollY + (rect.height - spinnerSize) / 2
    const left = rect.right + scrollX - spinnerSize - 8

    spinner.style.top = `${top}px`
    spinner.style.left = `${left}px`
  }

  updatePosition()
  document.body.appendChild(spinner)

  let timer: ReturnType<typeof setTimeout> | null = null
  const scheduleUpdate = () => {
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      updatePosition()
    }, 100)
  }

  const mutationObserver = new MutationObserver(() => {
    if (!spinner.isConnected)
      return
    scheduleUpdate()
  })

  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  })

  window.addEventListener("scroll", scheduleUpdate, { passive: true })
  window.addEventListener("resize", scheduleUpdate)

  return () => {
    mutationObserver.disconnect()
    window.removeEventListener("scroll", scheduleUpdate)
    window.removeEventListener("resize", scheduleUpdate)
    if (timer)
      clearTimeout(timer)
    spinner.remove()
  }
}

export function useInputTranslation() {
  const [inputTranslation] = useAtom(configFieldsAtomMap.inputTranslation)
  const cleanupSpinnerRef = useRef<(() => void) | null>(null)

  const hideSpinner = useCallback(() => {
    if (cleanupSpinnerRef.current) {
      cleanupSpinnerRef.current()
      cleanupSpinnerRef.current = null
    }
  }, [])

  useEffect(() => hideSpinner, [hideSpinner])

  const translate = useCallback(async (text: string, element: HTMLElement) => {
    if (!inputTranslation?.enabled)
      return

    cleanupSpinnerRef.current = showSpinner(element)

    try {
      await translateTextForInput(text)
      setLastCycleSwapped(true)
    }
    finally {
      hideSpinner()
    }
  }, [hideSpinner, inputTranslation?.enabled])

  return {
    SPACE_KEY,
    TRIGGER_COUNT,
    getLastCycleSwapped,
    setLastCycleSwapped,
    translate,
    trackAttempt: () => {
      const context = createFeatureUsageContext({
        feature: ANALYTICS_FEATURE.INPUT_TRANSLATION,
        surface: ANALYTICS_SURFACE.SELECTION,
      })
      trackFeatureAttempt(context)
    },
  }
}
