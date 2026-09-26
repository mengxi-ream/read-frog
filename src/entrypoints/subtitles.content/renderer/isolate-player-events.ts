const PLAYER_EVENTS = ["click", "mousedown", "pointerdown", "dblclick"] as const

// Embedded players toggle playback on any press inside them, including presses on our UI.
export function isolatePlayerEvents(host: HTMLElement): void {
  for (const type of PLAYER_EVENTS) {
    host.addEventListener(type, (event) => event.stopPropagation())
  }
}
