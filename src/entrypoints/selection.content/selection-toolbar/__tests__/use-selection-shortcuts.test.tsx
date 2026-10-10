// @vitest-environment jsdom
import { act, render } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SELECTION_SHORTCUT_CLAIMED_EVENT } from "@/utils/constants/selection"
import { useSelectionShortcuts } from "../use-selection-shortcuts"

const ownUi = vi.hoisted(() => ({ wrapper: null as HTMLElement | null }))

// The extension's own UI: the wrapper the selection content script renders
// into, inside its shadow root.
vi.mock("../..", () => ({
  get shadowWrapper() {
    return ownUi.wrapper
  },
}))

const run = vi.fn<(id: string) => boolean>(() => true)

function Bindings() {
  useSelectionShortcuts({ dictionary: "Alt+Shift+D" }, (id) => run(id))
  return null
}

function pressFrom(target: Element, { repeat = false, type = "keydown" } = {}) {
  const event = new KeyboardEvent(type, {
    key: "D",
    code: "KeyD",
    altKey: true,
    shiftKey: true,
    repeat,
    bubbles: true,
    composed: true,
    cancelable: true,
  })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

afterEach(() => {
  run.mockClear()
  ownUi.wrapper = null
  document.body.replaceChildren()
})

describe("useSelectionShortcuts", () => {
  it("tells the paragraph hotkey about a key it claims, and only then", () => {
    const claimed = vi.fn<() => void>()
    window.addEventListener(SELECTION_SHORTCUT_CLAIMED_EVENT, claimed)
    render(
      <Provider store={createStore()}>
        <Bindings />
      </Provider>,
    )

    try {
      run.mockReturnValueOnce(false)
      expect(pressFrom(document.body).defaultPrevented).toBe(false)
      expect(claimed).not.toHaveBeenCalled()

      expect(pressFrom(document.body).defaultPrevented).toBe(true)
      expect(claimed).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener(SELECTION_SHORTCUT_CLAIMED_EVENT, claimed)
    }
  })

  it("keeps a held key's repeats from the page when its first press ran, without running again", () => {
    render(
      <Provider store={createStore()}>
        <Bindings />
      </Provider>,
    )

    expect(pressFrom(document.body).defaultPrevented).toBe(true)
    expect(pressFrom(document.body, { repeat: true }).defaultPrevented).toBe(true)
    expect(pressFrom(document.body, { repeat: true }).defaultPrevented).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)

    // Released, then held where nothing ran: its repeats stay the page's.
    pressFrom(document.body, { type: "keyup" })
    run.mockReturnValueOnce(false)
    expect(pressFrom(document.body).defaultPrevented).toBe(false)
    expect(pressFrom(document.body, { repeat: true }).defaultPrevented).toBe(false)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("leaves the keys to a field in a shadow root nested in the extension's own UI", () => {
    const uiHost = document.createElement("div")
    document.body.appendChild(uiHost)
    const wrapper = document.createElement("div")
    uiHost.attachShadow({ mode: "open" }).appendChild(wrapper)
    ownUi.wrapper = wrapper
    // A custom action's card renders in a shadow root of its own.
    const cardHost = document.createElement("div")
    wrapper.appendChild(cardHost)
    const input = document.createElement("input")
    cardHost.attachShadow({ mode: "open" }).appendChild(input)
    render(
      <Provider store={createStore()}>
        <Bindings />
      </Provider>,
    )

    input.focus()
    const typed = pressFrom(input)
    expect(run).not.toHaveBeenCalled()
    expect(typed.defaultPrevented).toBe(false)

    input.blur()
    const pressed = pressFrom(document.body)
    expect(run).toHaveBeenCalledWith("dictionary")
    expect(pressed.defaultPrevented).toBe(true)
  })
})
