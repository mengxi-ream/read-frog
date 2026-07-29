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

  // jsdom has no `window.navigation`, so this exercises the monkeypatch-only
  // path (Firefox/Safari). In Chrome the same pushState is reported via
  // `currententrychange` instead — see the ordering test below.
  it("fires on pushState pathname changes and ignores hash-only updates (no Navigation API)", () => {
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

  it("dispatches exactly one event when currententrychange fires inside pushState (Chrome ordering)", () => {
    const navigation = installNavigationMock(`${origin}/a`)

    // In real Chrome (verified on 145), `currententrychange` fires
    // SYNCHRONOUSLY inside `history.pushState()` — before the monkeypatched
    // wrapper resumes and runs its own fire(). Simulate that ordering with a
    // fake "native" pushState that commits the URL and dispatches
    // currententrychange, installed BEFORE the listener monkeypatches over
    // it. The guard under test: the wrapper's fire() must see `prev` already
    // advanced by the currententrychange handler and stay silent, so both
    // detection paths together dispatch exactly one URLChange event.
    const realPushState = window.history.pushState.bind(window.history)
    window.history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
      realPushState(data, unused, url)
      navigation.currentEntry.url = window.location.href
      navigation.dispatch("currententrychange")
    }) as typeof window.history.pushState

    try {
      cleanup = setupUrlChangeListener()

      window.history.pushState({}, "", `${origin}/b`)
      expect(events).toEqual([
        {
          from: `${origin}/a`,
          to: `${origin}/b`,
          reason: "currententrychange",
        },
      ])
    } finally {
      // Listener cleanup restores our fake native; then restore the real one.
      cleanup?.()
      cleanup = undefined
      window.history.pushState = realPushState
    }
  })
})
