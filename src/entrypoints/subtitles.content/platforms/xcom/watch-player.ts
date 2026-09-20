import debounce from "debounce"
import { XCOM_PLAYER_MUTATION_DEBOUNCE_MS } from "@/utils/constants/subtitles"

// Watches the document, not the player container: x.com swaps the container on
// navigation, and an observer bound to the old one never fires again.
export function watchXcomPlayer(onChanged: () => void) {
  const trigger = debounce(onChanged, XCOM_PLAYER_MUTATION_DEBOUNCE_MS)
  // Leading edge as well as trailing: the controls bar fades in from the mutation
  // that creates it, so waiting out the debounce lands our button mid-fade.
  const observer = new MutationObserver(() => {
    if (!trigger.isPending) {
      onChanged()
    }
    trigger()
  })
  observer.observe(document.body, { childList: true, subtree: true })

  return () => {
    trigger.clear()
    observer.disconnect()
  }
}
