// @vitest-environment jsdom
import type { ComponentProps, ReactElement } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TranslateButton } from ".."

const prepareToolbarOpenMock = vi.fn()

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("@/components/ui/selection-popover", () => ({
  SelectionPopover: {
    Trigger: ({ children, ...props }: ComponentProps<"button">) => (
      <button type="button" {...props}>
        {children}
      </button>
    ),
  },
}))

vi.mock("../../../components/selection-tooltip", () => ({
  SelectionToolbarTooltip: ({ render }: { render: ReactElement }) => render,
}))

vi.mock("../provider", () => ({
  useSelectionTranslationPopover: () => ({
    prepareToolbarOpen: prepareToolbarOpenMock,
  }),
}))

describe("translateButton", () => {
  beforeEach(() => {
    prepareToolbarOpenMock.mockReset()
  })

  it("blurs the toolbar trigger before opening the translation popover", () => {
    render(<TranslateButton />)

    const trigger = screen.getByRole("button", { name: "action.translation" })
    const blurSpy = vi.spyOn(trigger, "blur")

    trigger.focus()
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)

    expect(blurSpy).toHaveBeenCalledOnce()
    expect(prepareToolbarOpenMock).toHaveBeenCalledOnce()
    expect(blurSpy.mock.invocationCallOrder[0]).toBeLessThan(prepareToolbarOpenMock.mock.invocationCallOrder[0]!)
    expect(document.activeElement).not.toBe(trigger)
  })
})
