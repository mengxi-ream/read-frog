// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ColorPicker, ColorPickerPopover } from "@/components/ui/base-ui/color-picker"

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", NoopResizeObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function type(input: HTMLElement, text: string) {
  act(() => input.focus())
  fireEvent.change(input, { target: { value: text } })
}

function press(element: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  act(() => {
    fireEvent.keyDown(element, { key, ...init })
  })
}

function channel(name: string) {
  return screen.getByRole<HTMLInputElement>("textbox", { name })
}

describe("ColorPicker", () => {
  describe("hex field", () => {
    it("commits the typed colour on Enter", () => {
      const onValueChange = vi.fn<(value: string) => void>()
      render(<ColorPicker defaultValue="#6B97FF" hideEyedropper onValueChange={onValueChange} />)

      type(channel("Hex value"), "FF0000")
      press(channel("Hex value"), "Enter")

      expect(onValueChange).toHaveBeenLastCalledWith("#ff0000")
      expect(channel("Hex value").value).toBe("FF0000")
    })

    it("puts the last colour back on Escape", () => {
      const onValueChange = vi.fn<(value: string) => void>()
      render(<ColorPicker defaultValue="#6B97FF" hideEyedropper onValueChange={onValueChange} />)

      type(channel("Hex value"), "FF0000")
      press(channel("Hex value"), "Escape")

      expect(onValueChange).not.toHaveBeenCalled()
      expect(channel("Hex value").value).toBe("6B97FF")
    })
  })

  describe("numeric channels", () => {
    it("commit the typed number on Enter", () => {
      const onValueChange = vi.fn<(value: string) => void>()
      render(<ColorPicker defaultValue="#6B97FF" hideEyedropper onValueChange={onValueChange} />)

      type(channel("Alpha"), "40")
      press(channel("Alpha"), "Enter")

      expect(onValueChange).toHaveBeenLastCalledWith("#6b97ff66")
      expect(channel("Alpha").value).toBe("40%")
    })

    it("put the last value back on Escape", () => {
      const onValueChange = vi.fn<(value: string) => void>()
      render(<ColorPicker defaultValue="#6B97FF" hideEyedropper onValueChange={onValueChange} />)

      type(channel("Alpha"), "40")
      press(channel("Alpha"), "Escape")

      expect(onValueChange).not.toHaveBeenCalled()
      expect(channel("Alpha").value).toBe("100%")
    })
  })

  describe("controlled value", () => {
    function Controlled() {
      const [value, setValue] = useState("#ff0000")
      return (
        <>
          <button type="button" onClick={() => setValue("#00ff00")}>
            green
          </button>
          <button type="button" onClick={() => setValue("#0000ff")}>
            blue
          </button>
          <ColorPicker value={value} onValueChange={setValue} hideEyedropper />
        </>
      )
    }

    it("applies an outside change back to a value the picker emitted", () => {
      render(<Controlled />)

      type(channel("Hex value"), "0000FF")
      press(channel("Hex value"), "Enter")
      fireEvent.click(screen.getByRole("button", { name: "green" }))
      expect(channel("Hex value").value).toBe("00FF00")

      // An undo: the parent restores the exact string the picker emitted earlier.
      fireEvent.click(screen.getByRole("button", { name: "blue" }))
      expect(channel("Hex value").value).toBe("0000FF")
    })
  })

  describe("saturation square", () => {
    it("stops dragging when it loses the pointer capture", () => {
      const onValueChange = vi.fn<(value: string) => void>()
      render(<ColorPicker defaultValue="#6B97FF" hideEyedropper onValueChange={onValueChange} />)
      const square = screen.getByRole("application", { name: "Saturation and brightness" })
      vi.spyOn(square, "getBoundingClientRect").mockReturnValue({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        toJSON: () => ({}),
      })
      // jsdom has no pointer capture.
      square.setPointerCapture = () => {}

      fireEvent.pointerDown(square, { pointerId: 1, button: 0, clientX: 50, clientY: 50 })
      // The drag ends without a pointerup on the square, e.g. a pointercancel.
      fireEvent.lostPointerCapture(square, { pointerId: 1 })
      onValueChange.mockClear()
      fireEvent.pointerMove(square, { pointerId: 1, clientX: 10, clientY: 90 })

      expect(onValueChange).not.toHaveBeenCalled()
    })
  })

  describe("OKLCH hue", () => {
    // Black has no hue, so the typed one can only live in the sticky state.
    function renderBlackWithStatedHue() {
      render(<ColorPicker defaultValue="#000000" defaultFormat="oklch" hideEyedropper />)
      type(channel("Hue"), "200")
      press(channel("Hue"), "Enter")
      expect(channel("Hue").value).toBe("200")
    }

    it("follows the colour once the square moves it", () => {
      renderBlackWithStatedHue()

      // Up to HSV (0, 50%, 50%): a dark red, whose OKLCH hue is about 22°.
      const square = screen.getByRole("application", { name: "Saturation and brightness" })
      for (let i = 0; i < 5; i++) {
        press(square, "ArrowUp", { shiftKey: true })
        press(square, "ArrowRight", { shiftKey: true })
      }

      expect(Number(channel("Hue").value)).toBeLessThan(40)
    })

    it("keeps the stated hue across alpha edits", () => {
      renderBlackWithStatedHue()

      type(channel("Alpha"), "50")
      press(channel("Alpha"), "Enter")

      expect(channel("Hue").value).toBe("200")
    })
  })

  describe("popover trigger", () => {
    it("names a swatch-only trigger after its color", () => {
      render(<ColorPickerPopover value="#6B97FF" triggerShowValue={false} />)

      expect(screen.getByRole("button", { name: "Color 6B97FF" })).toBeInTheDocument()
    })

    it("lets the printed value name the trigger otherwise", () => {
      render(<ColorPickerPopover value="#6B97FF" />)

      expect(screen.getByRole("button", { name: "6B97FF" })).not.toHaveAttribute("aria-label")
    })
  })
})
