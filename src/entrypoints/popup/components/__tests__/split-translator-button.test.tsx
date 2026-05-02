// @vitest-environment jsdom
import { browser, i18n } from "#imports"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SplitTranslatorButton } from "../split-translator-button"

const sendMessageMock = vi.fn()
const toastErrorMock = vi.fn()
const toastInfoMock = vi.fn()
const i18nTMock = vi.spyOn(i18n, "t").mockImplementation((key: string) => key)

vi.mock("@/components/ui/base-ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/utils/message", () => ({
  sendMessage: (...args: unknown[]) => sendMessageMock(...args),
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    info: (...args: unknown[]) => toastInfoMock(...args),
  },
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe("splitTranslatorButton", () => {
  beforeEach(() => {
    browser.windows.getCurrent = vi.fn().mockResolvedValue({ id: 42 })
  })
  it("sends an extension user-action side panel toggle message", async () => {
    sendMessageMock.mockResolvedValue({ ok: true, action: "opened" })

    render(<SplitTranslatorButton className="w-full" />)

    // Wait for useEffect to resolve the real window ID
    await waitFor(() => {
      expect(browser.windows.getCurrent).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole("button", { name: "popup.splitTranslator.open" }))

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith("toggleSidePanel", {
        source: "extension-user-action",
        windowId: 42,
      })
    })
    expect(toastErrorMock).not.toHaveBeenCalled()
    expect(toastInfoMock).not.toHaveBeenCalled()
  })

  it("is silent when the side panel is closed via toggle", async () => {
    sendMessageMock.mockResolvedValue({ ok: true, action: "closed" })

    render(<SplitTranslatorButton />)
    fireEvent.click(screen.getByRole("button", { name: "popup.splitTranslator.open" }))

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalled()
    })
    expect(toastErrorMock).not.toHaveBeenCalled()
    expect(toastInfoMock).not.toHaveBeenCalled()
  })

  it("shows a Firefox sidebar hint when Firefox requires a browser user action", async () => {
    sendMessageMock.mockResolvedValue({ ok: false, reason: "requires-extension-user-action" })

    render(<SplitTranslatorButton />)
    fireEvent.click(screen.getByRole("button", { name: "popup.splitTranslator.open" }))

    await waitFor(() => {
      expect(toastInfoMock).toHaveBeenCalledWith("popup.splitTranslator.firefoxSidebarHint")
    })
  })

  it("shows a failure message for other unsuccessful toggle results", async () => {
    sendMessageMock.mockResolvedValue({ ok: false, reason: "unsupported" })

    render(<SplitTranslatorButton />)
    fireEvent.click(screen.getByRole("button", { name: "popup.splitTranslator.open" }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("popup.splitTranslator.openFailed")
    })
  })

  it("shows a failure message when sending the toggle message rejects", async () => {
    sendMessageMock.mockRejectedValue(new Error("runtime unavailable"))

    render(<SplitTranslatorButton />)
    fireEvent.click(screen.getByRole("button", { name: "popup.splitTranslator.open" }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("popup.splitTranslator.openFailed")
    })
  })

  it("renders with a localized label", () => {
    render(<SplitTranslatorButton />)

    expect(i18nTMock).toHaveBeenCalledWith("popup.splitTranslator.open")
  })
})
