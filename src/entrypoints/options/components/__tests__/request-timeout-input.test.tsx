// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RequestTimeoutInput } from "../request-timeout-input"

const { addToastMock } = vi.hoisted(() => ({
  addToastMock: vi.fn<(toast: { type: string; title: string }) => void>(),
}))

vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: addToastMock },
}))

/** Types `value` one keystroke at a time, as the reader would. */
function typeInto(input: HTMLInputElement, value: string) {
  for (let length = 1; length <= value.length; length++) {
    fireEvent.change(input, { target: { value: value.slice(0, length) } })
  }
}

describe("request timeout input", () => {
  const onTimeoutMsChange = vi.fn<(timeoutMs: number) => void>()

  beforeEach(() => {
    onTimeoutMsChange.mockReset()
    addToastMock.mockReset()
  })

  function renderInput(timeoutMs = 120_000) {
    const view = render(
      <RequestTimeoutInput timeoutMs={timeoutMs} onTimeoutMsChange={onTimeoutMsChange} />,
    )
    return { ...view, input: screen.getByRole<HTMLInputElement>("spinbutton") }
  }

  it("shows the stored milliseconds as seconds", () => {
    expect(renderInput(20_000).input.value).toBe("20")
  })

  it("saves nothing while typing, and the typed value on blur", () => {
    const { input } = renderInput()

    typeInto(input, "90")
    expect(onTimeoutMsChange).not.toHaveBeenCalled()

    fireEvent.blur(input)
    expect(onTimeoutMsChange).toHaveBeenCalledExactlyOnceWith(90_000)
    expect(addToastMock).not.toHaveBeenCalled()
  })

  it("keeps the saved value when an over-limit number passes through a valid prefix", () => {
    const { input } = renderInput(120_000)

    // "30" is valid on the way to "300"; it must not be what ends up saved.
    typeInto(input, "300")
    fireEvent.blur(input)

    expect(onTimeoutMsChange).not.toHaveBeenCalled()
    expect(addToastMock).toHaveBeenCalledExactlyOnceWith({
      type: "error",
      title: "Request timeout must be at most 180 seconds",
    })
    expect(input.value).toBe("120")
  })

  it("refuses an empty field and goes back to the saved value", () => {
    const { input } = renderInput(60_000)

    fireEvent.change(input, { target: { value: "" } })
    fireEvent.blur(input)

    expect(onTimeoutMsChange).not.toHaveBeenCalled()
    expect(addToastMock).toHaveBeenCalledExactlyOnceWith({
      type: "error",
      title: "Request timeout must be at least 5 seconds",
    })
    expect(input.value).toBe("60")
  })

  it("saves on Enter", () => {
    const { input } = renderInput()
    input.focus()

    typeInto(input, "45")
    fireEvent.keyDown(input, { key: "Enter" })

    expect(onTimeoutMsChange).toHaveBeenCalledExactlyOnceWith(45_000)
  })

  it("rounds fractional seconds to whole milliseconds", () => {
    const { input } = renderInput()

    fireEvent.change(input, { target: { value: "12.3456" } })
    fireEvent.blur(input)

    expect(onTimeoutMsChange).toHaveBeenCalledExactlyOnceWith(12_346)
  })

  it("does not write when the value is unchanged", () => {
    const { input } = renderInput(20_000)

    fireEvent.blur(input)

    expect(onTimeoutMsChange).not.toHaveBeenCalled()
    expect(addToastMock).not.toHaveBeenCalled()
  })

  it("follows a value changed elsewhere", () => {
    const { input, rerender } = renderInput(20_000)

    rerender(<RequestTimeoutInput timeoutMs={75_000} onTimeoutMsChange={onTimeoutMsChange} />)

    expect(input.value).toBe("75")
  })
})
