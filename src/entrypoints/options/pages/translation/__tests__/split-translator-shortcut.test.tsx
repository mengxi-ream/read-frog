// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SPLIT_TRANSLATOR_COMMAND } from "@/entrypoints/background/split-translator-command"

const i18nTMock = vi.hoisted(() => vi.fn((key: string) => key))
const getExtensionCommandShortcutMock = vi.fn()
const openExtensionShortcutSettingsMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock("#imports", () => ({
  i18n: {
    t: i18nTMock,
  },
}))

vi.mock("#i18n", () => ({
  i18n: {
    t: i18nTMock,
  },
}))

vi.mock("@/components/ui/base-ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/base-ui/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
}))

vi.mock("@/utils/extension-command-shortcut", () => ({
  getExtensionCommandShortcut: (...args: unknown[]) => getExtensionCommandShortcutMock(...args),
}))

vi.mock("@/utils/page-translation-shortcut", () => ({
  formatPageTranslationShortcut: (shortcut: string) => shortcut,
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

async function renderSplitTranslatorShortcut() {
  const { SplitTranslatorShortcut } = await import("../split-translator-shortcut")
  return render(<SplitTranslatorShortcut />)
}

describe("splitTranslatorShortcut", () => {
  it("renders the current split translator shortcut when one is configured", async () => {
    getExtensionCommandShortcutMock.mockResolvedValue("Alt+S")

    await renderSplitTranslatorShortcut()

    expect(screen.getByText("options.translation.splitTranslatorShortcut.title")).toBeInTheDocument()
    expect(screen.getByText("options.translation.splitTranslatorShortcut.description")).toBeInTheDocument()
    expect(await screen.findByDisplayValue("Alt+S")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "options.translation.splitTranslatorShortcut.openSettings" })).toBeInTheDocument()
    expect(getExtensionCommandShortcutMock).toHaveBeenCalledWith(SPLIT_TRANSLATOR_COMMAND)
  })

  it("renders an unset label when the browser command has no shortcut", async () => {
    getExtensionCommandShortcutMock.mockResolvedValue("")

    await renderSplitTranslatorShortcut()

    expect(await screen.findByDisplayValue("options.translation.splitTranslatorShortcut.unset")).toBeInTheDocument()
  })

  it("falls back to the unset label when reading the browser command fails", async () => {
    getExtensionCommandShortcutMock.mockRejectedValue(new Error("blocked"))

    await renderSplitTranslatorShortcut()

    expect(await screen.findByDisplayValue("options.translation.splitTranslatorShortcut.unset")).toBeInTheDocument()
  })

  it("opens browser shortcut settings when clicked", async () => {
    getExtensionCommandShortcutMock.mockResolvedValue("Alt+S")
    openExtensionShortcutSettingsMock.mockResolvedValue(undefined)

    await renderSplitTranslatorShortcut()
    fireEvent.click(screen.getByRole("button", { name: "options.translation.splitTranslatorShortcut.openSettings" }))

    await waitFor(() => {
      expect(openExtensionShortcutSettingsMock).toHaveBeenCalledTimes(1)
    })
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it("shows an error toast when browser shortcut settings cannot be opened", async () => {
    getExtensionCommandShortcutMock.mockResolvedValue("Alt+S")
    openExtensionShortcutSettingsMock.mockRejectedValue(new Error("blocked"))

    await renderSplitTranslatorShortcut()
    fireEvent.click(screen.getByRole("button", { name: "options.translation.splitTranslatorShortcut.openSettings" }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("options.translation.splitTranslatorShortcut.openFailed")
    })
  })
})
