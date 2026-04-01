// @vitest-environment jsdom
import type { ReactElement } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { SelectionToolbarCustomActionTrigger } from "../custom-action-trigger"

const openToolbarCustomActionMock = vi.fn()

vi.mock("../../../components/selection-tooltip", () => ({
  SelectionToolbarTooltip: ({ render }: { render: ReactElement }) => render,
}))

vi.mock("../provider", () => ({
  useSelectionCustomActionPopover: () => ({
    openToolbarCustomAction: openToolbarCustomActionMock,
  }),
}))

describe("selectionToolbarCustomActionTrigger", () => {
  beforeEach(() => {
    openToolbarCustomActionMock.mockReset()
  })

  it("blurs the toolbar trigger before opening the custom action popover", () => {
    render(
      <SelectionToolbarCustomActionTrigger
        action={{
          id: "summarize",
          name: "Summarize",
          icon: "tabler:sparkles",
          providerId: "openai-default",
          systemPrompt: "system",
          prompt: "prompt",
          outputSchema: [
            {
              id: "summary",
              name: "Summary",
              type: "string",
              description: "",
              speaking: false,
            },
          ],
        }}
      />,
    )

    const trigger = screen.getByRole("button", { name: "Summarize" })
    const blurSpy = vi.spyOn(trigger, "blur")

    trigger.focus()
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)

    expect(blurSpy).toHaveBeenCalledOnce()
    expect(openToolbarCustomActionMock).toHaveBeenCalledOnce()
    expect(openToolbarCustomActionMock).toHaveBeenCalledWith("summarize", trigger)
    expect(blurSpy.mock.invocationCallOrder[0]).toBeLessThan(openToolbarCustomActionMock.mock.invocationCallOrder[0]!)
    expect(document.activeElement).not.toBe(trigger)
  })
})
