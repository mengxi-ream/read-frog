import debounce from "debounce"
import { XCOM_CONTROLS_MUTATION_DEBOUNCE_MS } from "@/utils/constants/subtitles"

// Observes the video container, not the document: the timeline mutates constantly.
export function watchXcomPlayerControls(onControlsChanged: () => void) {
  const trigger = debounce(onControlsChanged, XCOM_CONTROLS_MUTATION_DEBOUNCE_MS)
  const observer = new MutationObserver(trigger)
  let observed: HTMLElement | null = null

  return {
    observe(videoContainer: HTMLElement) {
      if (observed === videoContainer) {
        return
      }

      observer.disconnect()
      observed = videoContainer
      observer.observe(videoContainer, { childList: true, subtree: true })
    },
    disconnect() {
      trigger.clear()
      observer.disconnect()
      observed = null
    },
  }
}
