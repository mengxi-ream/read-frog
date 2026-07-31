import type { MouseEvent } from "react"
import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router"

/**
 * Marks a history entry as drilled into from the page behind it. The detail page's back control
 * reads it to decide whether it can pop that entry instead of pushing a new one — popping is what
 * lets `ScrollRestoration` put the user back on the row they clicked.
 */
export const DRILL_IN_LOCATION_STATE = { drillIn: true } as const

function isDrillInState(state: unknown): boolean {
  return (
    typeof state === "object" && state !== null && (state as { drillIn?: unknown }).drillIn === true
  )
}

/**
 * Click handler for a detail page's back link. Pops the drill-in entry when this app pushed it,
 * and otherwise does nothing so the link navigates normally — a reload, a deep link or a search
 * result can land on a detail page with nothing to go back to.
 */
export function useDrillInBack(): (event: MouseEvent<HTMLElement>) => void {
  const navigate = useNavigate()
  const { state } = useLocation()
  const canPopDrillIn = isDrillInState(state)

  return useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!canPopDrillIn || !isPlainLeftClick(event)) {
        return
      }
      event.preventDefault()
      void navigate(-1)
    },
    [canPopDrillIn, navigate],
  )
}

/** Modified clicks belong to the browser — open in a new tab, download, and so on. */
function isPlainLeftClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}
