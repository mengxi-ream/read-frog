// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { setupUrlChangeListener } from "../listen"

type NavigationListener = (event?: Event) => void

function installNavigationMock(initialUrl: string) {
  const listeners = new Map<string, Set<NavigationListener>>()
  const navigation = {
    currentEntry: { url: initialUrl },
    addEventListener: vi.fn<(type: string, listener: NavigationListener) => void>(
      (type, listener) => {
        const set = listeners.get(type) ?? new Set()
        set.add(listener)
        listeners.set(type, set)
      },
    ),
    removeEventListener: vi.fn<(type: string, listener: NavigationListener) => void>(
      (type, listener) => {
        listeners.get(type)?.delete(listener)
      },
    ),
    dispatch(type: string) {
      for (const listener of listeners.get(type) ?? []) {
        listener()
      }
    },
  }

  Object.defineProperty(window, "navigation", {
    configurable: true,
    value: navigation,
    writable: true,
  })

  return navigation
}

describe("setupUrlChangeListener", () => {
  let cleanup: (() => void) | undefined
  let events: Array<{ from: string; to: string; reason: string }>
  let origin: string
  let onUrlChange: EventListener

  beforeEach(() => {
    events = []
    origin = window.location.origin
    // Ensure a clean, same-origin path before any history monkeypatch is installed.
    window.history.replaceState({}, "", `${origin}/a`)
    onUrlChange = ((e: CustomEvent) => {
      events.push(e.detail)
    }) as EventListener
    window.addEventListener("extension:URLChange", onUrlChange)
  })

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    window.removeEventListener("extension:URLChange", onUrlChange)
    Reflect.deleteProperty(window, "navigation")
  })

  it("does not fire on Navigation API navigate (pre-commit) events", () => {
    const navigation = installNavigationMock(`${origin}/a`)
    cleanup = setupUrlChangeListener()

    navigation.currentEntry.url = `${origin}/a`
    navigation.dispatch("navigate")

    expect(events).toEqual([])
  })

  it("fires after Navigation API currententrychange when the URL commits", () => {
    const navigation = installNavigationMock(`${origin}/a`)
    cleanup = setupUrlChangeListener()

    // Update only the Navigation API entry — avoid history.replaceState here,
    // which would also emit via the pushState/replaceState monkeypatch.
    navigation.currentEntry.url = `${origin}/b`
    navigation.dispatch("currententrychange")

    expect(events).toEqual([
      {
        from: `${origin}/a`,
        to: `${origin}/b`,
        reason: "currententrychange",
      },
    ])
  })

  it("fires on pushState pathname changes and ignores hash-only updates", () => {
    cleanup = setupUrlChangeListener()

    window.history.pushState({}, "", `${origin}/a#section`)
    expect(events).toEqual([])

    window.history.pushState({}, "", `${origin}/b`)
    expect(events).toEqual([
      {
        from: `${origin}/a#section`,
        to: `${origin}/b`,
        reason: "pushState",
      },
    ])
  })
})
