// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { i18n } from "#imports"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SplitTranslatorShortcut } from "../split-translator-shortcut"

const openExtensionShortcutSettingsMock = vi.fn()
const toastErrorMock = vi.fn()
const i18nTMock = vi.spyOn(i18n, "t").mockImplementation((key: string, values?: unknown[]) => values ? `${key}:${values.join(",")}` : key)

vi.mock("@/components/ui/base-ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/utils/navigation", () => ({
  openExtensionShortcutSettings: (...args: unknown[]) => openExtensionShortcutSettingsMock(...args),
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe("SplitTranslatorShortcut", () => {
  it("renders the split translator shortcut settings card", () => {
    render(<SplitTranslatorShortcut />)

    expect(screen.getByText("options.translation.splitTranslatorShortcut.title")).toBeInTheDocument()
    expect(screen.getByText("options.translation.splitTranslatorShortcut.description:Alt+S")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "options.translation.splitTranslatorShortcut.openSettings" })).toBeInTheDocument()
    expect(i18nTMock).toHaveBeenCalledWith("options.translation.splitTranslatorShortcut.description", ["Alt+S"])
  })

  it("opens browser shortcut settings when clicked", async () => {
    openExtensionShortcutSettingsMock.mockResolvedValue(undefined)

    render(<SplitTranslatorShortcut />)
    fireEvent.click(screen.getByRole("button", { name: "options.translation.splitTranslatorShortcut.openSettings" }))

    await waitFor(() => {
      expect(openExtensionShortcutSettingsMock).toHaveBeenCalledTimes(1)
    })
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it("shows an error toast when browser shortcut settings cannot be opened", async () => {
    openExtensionShortcutSettingsMock.mockRejectedValue(new Error("blocked"))

    render(<SplitTranslatorShortcut />)
    fireEvent.click(screen.getByRole("button", { name: "options.translation.splitTranslatorShortcut.openSettings" }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("options.translation.splitTranslatorShortcut.openFailed")
    })
  })
})
