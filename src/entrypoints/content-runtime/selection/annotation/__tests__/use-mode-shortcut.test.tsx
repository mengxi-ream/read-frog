// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useAnnotationModeShortcut } from "../use-mode-shortcut"

const onPress = vi.fn<() => void>()

function Binding({ shortcut }: { shortcut: string | undefined }) {
  useAnnotationModeShortcut(shortcut, onPress)
  return null
}

function press(target: EventTarget, { repeat = false, type = "keydown" } = {}) {
  const event = new KeyboardEvent(type, {
    key: "P",
    code: "KeyP",
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
  cleanup()
  onPress.mockClear()
  document.body.replaceChildren()
})

describe("useAnnotationModeShortcut", () => {
  it("runs on each press with nothing selected, and keeps the key from the page", () => {
    render(<Binding shortcut="Alt+Shift+P" />)

    expect(press(document.body).defaultPrevented).toBe(true)
    press(document.body, { type: "keyup" })
    press(document.body)

    expect(onPress).toHaveBeenCalledTimes(2)
  })

  it("runs once for a held key, not on its repeats", () => {
    render(<Binding shortcut="Alt+Shift+P" />)

    press(document.body)
    press(document.body, { repeat: true })
    press(document.body, { repeat: true })

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it("leaves the key to a text field being typed in", () => {
    render(<Binding shortcut="Alt+Shift+P" />)
    const input = document.createElement("input")
    document.body.append(input)
    input.focus()

    expect(press(input).defaultPrevented).toBe(false)
    expect(onPress).not.toHaveBeenCalled()
  })

  it("binds nothing without a key, and lets go of it on unmount", () => {
    const { rerender, unmount } = render(<Binding shortcut="" />)
    press(document.body)
    rerender(<Binding shortcut={undefined} />)
    press(document.body)
    expect(onPress).not.toHaveBeenCalled()

    rerender(<Binding shortcut="Alt+Shift+P" />)
    unmount()
    expect(press(document.body).defaultPrevented).toBe(false)
    expect(onPress).not.toHaveBeenCalled()
  })
})
