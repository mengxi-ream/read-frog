// @vitest-environment jsdom
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { sendMessage } from "@/utils/message"
import { CustomActionToolButton } from "../custom-action-tool-button"

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string, args?: string[]) => {
      if (key === "action.customizeCustomAction") {
        return `Customize ${args?.[0]} action`
      }

      return key
    },
  },
  initI18n: async () => {},
  setUiLanguage: async () => {},
}))

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn(),
}))

function createAction(): SelectionToolbarCustomAction {
  return {
    id: "action 1",
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
  }
}

describe("customActionToolButton", () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    document.body.innerHTML = ""
  })

  it("opens the selected custom action options page", () => {
    render(
      <TooltipProvider>
        <CustomActionToolButton action={createAction()} />
      </TooltipProvider>,
    )

    const button = screen.getByRole("button", { name: "Customize Summarize action" })

    expect(button).toHaveAttribute("title", "Customize Summarize action")
    expect(button).toHaveClass("size-7")

    fireEvent.click(button)

    expect(sendMessage).toHaveBeenCalledWith("openOptionsPage", {
      route: "/custom-actions?actionId=action%201",
    })
  })

  it("renders the action-specific tooltip", async () => {
    render(
      <TooltipProvider>
        <CustomActionToolButton action={createAction()} />
      </TooltipProvider>,
    )

    const button = screen.getByRole("button", { name: "Customize Summarize action" })

    fireEvent.mouseEnter(button)
    fireEvent.focus(button)

    await waitFor(() => {
      expect(document.querySelector("[data-slot='tooltip-content']")).toHaveTextContent("Customize Summarize action")
    })
  })
})
