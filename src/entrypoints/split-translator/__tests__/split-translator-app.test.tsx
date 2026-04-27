// @vitest-environment jsdom
import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { Provider as JotaiProvider } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import App from "../app"

const translateTextCoreMock = vi.fn()
const detectLanguageMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()
const toastWarningMock = vi.fn()

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
}))

vi.mock("@iconify/react", () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}))

vi.mock("@/utils/content/language", () => ({
  detectLanguage: (...args: unknown[]) => detectLanguageMock(...args),
}))

vi.mock("@/utils/host/translate/translate-text", async () => {
  const actual = await vi.importActual<typeof import("@/utils/host/translate/translate-text")>("@/utils/host/translate/translate-text")
  return {
    ...actual,
    translateTextCore: (...args: unknown[]) => translateTextCoreMock(...args),
  }
})

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
    warning: (...args: unknown[]) => toastWarningMock(...args),
  },
}))

function TestHydrateAtoms({ children }: { children: ReactNode }) {
  useHydrateAtoms([[configAtom, DEFAULT_CONFIG]])
  return children
}

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <JotaiProvider>
        <TestHydrateAtoms>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </TestHydrateAtoms>
      </JotaiProvider>
    </QueryClientProvider>,
  )
}

describe("split translator app", () => {
  beforeEach(() => {
    translateTextCoreMock.mockReset()
    detectLanguageMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    toastWarningMock.mockReset()
    detectLanguageMock.mockResolvedValue("eng")

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    })

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it("keeps submit disabled for empty input", () => {
    renderApp()

    expect(screen.getByRole("button", { name: "splitTranslator.translate" })).toBeDisabled()
  })

  it("lets the panel content fill the available split width", () => {
    const { container } = renderApp()

    const main = container.querySelector("main")

    expect(main).toHaveClass("w-full")
    expect(main).not.toHaveClass("max-w-xl")
  })

  it("submits text and renders the translated result", async () => {
    translateTextCoreMock.mockResolvedValue("Bonjour")
    renderApp()

    fireEvent.change(screen.getByLabelText("splitTranslator.inputLabel"), { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.translate" }))

    await waitFor(() => {
      expect(screen.getByText("Bonjour")).toBeInTheDocument()
    })
    expect(translateTextCoreMock).toHaveBeenCalledWith(expect.objectContaining({
      extraHashTags: ["splitTranslator"],
      text: "Hello",
    }))
  })

  it("marks the result region busy while translation is loading", async () => {
    let resolveTranslation: (value: string) => void
    translateTextCoreMock.mockReturnValue(new Promise<string>((resolve) => {
      resolveTranslation = resolve
    }))
    renderApp()

    fireEvent.change(screen.getByLabelText("splitTranslator.inputLabel"), { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.translate" }))

    const resultRegion = await screen.findByRole("status")
    expect(resultRegion).toHaveAttribute("aria-live", "polite")
    expect(resultRegion).toHaveAttribute("aria-busy", "true")
    expect(within(resultRegion).getByText("splitTranslator.translating")).toBeInTheDocument()

    resolveTranslation!("Bonjour")
    await screen.findByText("Bonjour")
  })

  it("shows a retryable error state when translation fails", async () => {
    translateTextCoreMock.mockRejectedValueOnce(new Error("Network failed"))
    renderApp()

    fireEvent.change(screen.getByLabelText("splitTranslator.inputLabel"), { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.translate" }))

    await waitFor(() => {
      expect(screen.getByText("Network failed")).toBeInTheDocument()
    })
    expect(screen.getByLabelText("splitTranslator.inputLabel")).toHaveValue("Hello")
    expect(screen.getByRole("button", { name: "splitTranslator.retry" })).toBeEnabled()

    translateTextCoreMock.mockResolvedValueOnce("Bonjour")
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.retry" }))

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(2)
      expect(screen.getByText("Bonjour")).toBeInTheDocument()
    })
  })

  it("retries with the current textarea value after editing failed input", async () => {
    translateTextCoreMock
      .mockRejectedValueOnce(new Error("Network failed"))
      .mockResolvedValueOnce("Bonjour")
    renderApp()

    fireEvent.change(screen.getByLabelText("splitTranslator.inputLabel"), { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.translate" }))

    await waitFor(() => {
      expect(screen.getByText("Network failed")).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText("splitTranslator.inputLabel"), { target: { value: "Hello!" } })
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.retry" }))

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
        extraHashTags: ["splitTranslator"],
        text: "Hello!",
      }))
      expect(screen.getByText("Bonjour")).toBeInTheDocument()
    })
  })

  it("copies translated result and reports success", async () => {
    translateTextCoreMock.mockResolvedValue("Bonjour")
    renderApp()

    fireEvent.change(screen.getByLabelText("splitTranslator.inputLabel"), { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.translate" }))
    await screen.findByText("Bonjour")
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.copyResult" }))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Bonjour")
      expect(toastSuccessMock).toHaveBeenCalledWith("splitTranslator.copied")
    })
  })

  it("shows an error toast when copying fails", async () => {
    translateTextCoreMock.mockResolvedValue("Bonjour")
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    })
    renderApp()

    fireEvent.change(screen.getByLabelText("splitTranslator.inputLabel"), { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.translate" }))
    await screen.findByText("Bonjour")
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.copyResult" }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("splitTranslator.copyFailed")
    })
  })
})
