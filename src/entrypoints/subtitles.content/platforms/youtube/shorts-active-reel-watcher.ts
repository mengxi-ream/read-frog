import debounce from "debounce"

const OVERLAY_CONTAINER_SELECTOR = "#reel-overlay-container"
const ACTIVE_REEL_SELECTOR = ".reel-video-in-sequence-new"
const SHORTS_CONTAINER_SELECTOR = "ytd-shorts"
const ACTIVE_REEL_CHANGE_DEBOUNCE_MS = 200

function getActiveReel(): HTMLElement | null {
  return document.querySelector(OVERLAY_CONTAINER_SELECTOR)?.closest<HTMLElement>(ACTIVE_REEL_SELECTOR) ?? null
}

export function watchShortsActiveReel(onActiveReelChanged: () => void) {
  let lastReel = getActiveReel()
  const trigger = debounce(onActiveReelChanged, ACTIVE_REEL_CHANGE_DEBOUNCE_MS)

  const root = document.querySelector(SHORTS_CONTAINER_SELECTOR) ?? document.body
  const observer = new MutationObserver(() => {
    const reel = getActiveReel()
    if (!reel || reel === lastReel) {
      return
    }

    lastReel = reel
    trigger()
  })

  observer.observe(root, { childList: true, subtree: true })
}
