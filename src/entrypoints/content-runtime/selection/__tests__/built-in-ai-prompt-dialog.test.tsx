// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  closeBuiltInAiPrompt,
  openBuiltInAiPrompt,
} from "@/utils/content-runtime/built-in-ai-prompt"
import { BuiltInAiPromptDialog } from "../built-in-ai-prompt-dialog"

const { mockSendMessage, mockTrackAction } = vi.hoisted(() => ({
  mockSendMessage: vi.fn<(...args: any[]) => any>(),
  mockTrackAction: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/message", () => ({ sendMessage: mockSendMessage }))

vi.mock("@/utils/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/analytics")>()),
  trackBuiltInAiPromptAction: mockTrackAction,
}))

function openUpgradePrompt() {
  act(() => {
    openBuiltInAiPrompt({
      kind: "upgrade",
      plan: "free",
      feature: "pageTranslation",
      analyticsFeature: "page_translation",
      trigger: "auto",
    })
  })
}

describe("BuiltInAiPromptDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendMessage.mockResolvedValue(undefined)
  })

  afterEach(() => {
    act(() => closeBuiltInAiPrompt())
  })

  it("records an upgrade as the dialog's, with the prompt's trigger, and opens pricing for the feature", () => {
    render(<BuiltInAiPromptDialog />)
    openUpgradePrompt()

    fireEvent.click(screen.getByRole("button", { name: "action.upgrade" }))

    expect(mockTrackAction).toHaveBeenCalledWith({
      feature: "page_translation",
      kind: "upgrade",
      presentation: "dialog",
      trigger: "auto",
      action: "upgrade",
    })
    const [, { url }] = mockSendMessage.mock.calls.find(([type]) => type === "openPage")!
    expect(new URL(url).searchParams.get("feature")).toBe("page_translation")
  })

  it("records a close as dismissed", () => {
    render(<BuiltInAiPromptDialog />)
    openUpgradePrompt()

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })

    expect(mockTrackAction).toHaveBeenCalledWith({
      feature: "page_translation",
      kind: "upgrade",
      presentation: "dialog",
      trigger: "auto",
      action: "dismissed",
    })
  })
})
