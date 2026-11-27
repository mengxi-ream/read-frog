// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { KnownCheck } from "../known-check"

vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))

function renderCheck(rect = { right: 300, top: 100 }) {
  const onPress = vi.fn<() => void>()
  const onParentClick = vi.fn<() => void>()
  render(
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div onClick={onParentClick}>
      <KnownCheck
        rect={rect}
        onPress={onPress}
        onPointerEnter={vi.fn<() => void>()}
        onPointerLeave={vi.fn<() => void>()}
      />
    </div>,
  )
  return { onPress, onParentClick, button: screen.getByRole("button") }
}

describe("knownCheck", () => {
  it("keeps the long description as the accessible name and puts the short label in the pill", () => {
    const { button } = renderCheck()

    expect(button.getAttribute("aria-label")).toBe("difficultWords.markKnown")
    // The label is in the tree for the hover to reveal, and hidden from readers,
    // which already get the description.
    const label = screen.getByText("difficultWords.known")
    expect(button.contains(label)).toBe(true)
    expect(label.getAttribute("aria-hidden")).toBe("true")
  })

  it("is placed by its right edge, so the label grows to the left of the ✓", () => {
    const { button } = renderCheck({ right: 300, top: 100 })

    // The circle's right edge is 10px past the word's, as the circle always was.
    expect(button.style.left).toBe("310px")
    expect(button.style.transform).toBe("translateX(-100%)")
  })

  it("never puts its right edge past the window", () => {
    const { button } = renderCheck({ right: window.innerWidth + 50, top: 100 })

    expect(button.style.left).toBe(`${window.innerWidth}px`)
  })

  it("presses without the click reaching the page", () => {
    const { button, onPress, onParentClick } = renderCheck()

    fireEvent.click(button)

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onParentClick).not.toHaveBeenCalled()
  })
})
