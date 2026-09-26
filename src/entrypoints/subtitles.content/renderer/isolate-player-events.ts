const PLAYER_EVENTS = ["click", "mousedown", "pointerdown", "dblclick"] as const

export function isolatePlayerEvents(host: HTMLElement): void {
  for (const type of PLAYER_EVENTS) {
    host.addEventListener(type, (event) => event.stopPropagation())
  }

  host.addEventListener("pointerdown", swallowClickReleasedOutside(host), { capture: true })
}

function swallowClickReleasedOutside(host: HTMLElement) {
  return () => {
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
