// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ShortcutKeyRecorder } from "../shortcut-key-recorder"

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

describe("shortcut key recorder", () => {
  it("records modifier shortcuts as portable strings", async () => {
    const onChange = vi.fn()

    render(<ShortcutKeyRecorder shortcutKey="Alt+E" onChange={onChange} />)

    const input = screen.getByPlaceholderText("shortcutKeySelector.placeholder")
    fireEvent.focus(input)
    fireEvent.keyDown(document, { key: "K", ctrlKey: true, shiftKey: true })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("Mod+Shift+K")
    })
  })

  it("uses the physical digit key for mac option combinations", async () => {
    const onChange = vi.fn()

    render(<ShortcutKeyRecorder shortcutKey="Alt+E" onChange={onChange} />)

    const input = screen.getByPlaceholderText("shortcutKeySelector.placeholder")
    fireEvent.focus(input)
    fireEvent.keyDown(document, { key: "£", altKey: true, code: "Digit3" })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("Alt+3")
    })
  })

  it("keeps recording after a single non-modifier key", async () => {
    const onChange = vi.fn()

    render(<ShortcutKeyRecorder shortcutKey="Alt+E" onChange={onChange} />)

    const input = screen.getByPlaceholderText("shortcutKeySelector.placeholder")
    fireEvent.focus(input)
    fireEvent.keyDown(document, { key: "K" })

    await waitFor(() => {
      expect(onChange).not.toHaveBeenCalled()
    })

    fireEvent.keyDown(document, { key: "E", altKey: true })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("Alt+E")
    })
  })

  it("cancels recording with Escape", async () => {
    const onChange = vi.fn()

    render(<ShortcutKeyRecorder shortcutKey="Alt+E" onChange={onChange} />)

    const input = screen.getByPlaceholderText("shortcutKeySelector.placeholder") as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.keyDown(document, { key: "Escape" })

    await waitFor(() => {
      expect(onChange).not.toHaveBeenCalled()
      expect(input.value).toBe("Alt+E")
    })
  })

  it("clears the shortcut with Backspace and Delete", async () => {
    const onChange = vi.fn()

    render(<ShortcutKeyRecorder shortcutKey="Alt+E" onChange={onChange} />)

    const input = screen.getByPlaceholderText("shortcutKeySelector.placeholder")

    fireEvent.focus(input)
    fireEvent.keyDown(document, { key: "Backspace" })

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("")
    })

    fireEvent.focus(input)
    fireEvent.keyDown(document, { key: "Delete" })

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith("")
    })
  })
})
