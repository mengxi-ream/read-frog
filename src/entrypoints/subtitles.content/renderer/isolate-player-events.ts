const PLAYER_EVENTS = ["click", "mousedown", "pointerdown", "dblclick"] as const

/**
 * Keeps presses on `host` from the video player it sits in. A host that is only
 * sometimes inside the player passes `isInsidePlayer`, so that the rest of the
 * time its presses reach the page as usual.
 */
export function isolatePlayerEvents(
  host: HTMLElement,
  isInsidePlayer: () => boolean = () => true,
): void {
  for (const type of PLAYER_EVENTS) {
    host.addEventListener(type, (event) => {
      if (isInsidePlayer()) {
        event.stopPropagation()
      }
    })
  }

  host.addEventListener("pointerdown", swallowClickReleasedOutside(host, isInsidePlayer), {
    capture: true,
  })
}

function swallowClickReleasedOutside(host: HTMLElement, isInsidePlayer: () => boolean) {
  return () => {
    if (!isInsidePlayer()) {
      return
    }
    const swallow = (event: MouseEvent) => {
      if (event.target instanceof Node && !host.contains(event.target)) {
        event.stopPropagation()
      }
    }

    window.addEventListener("click", swallow, { capture: true, once: true })
    window.addEventListener(
      "pointerup",
      () => setTimeout(() => window.removeEventListener("click", swallow, { capture: true })),
      { capture: true, once: true },
    )
  }
}
