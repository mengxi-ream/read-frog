// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import { LANG_CODE_TO_EN_NAME, LANG_CODE_TO_LOCALE_NAME } from "@read-frog/definitions"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { createStore, Provider as JotaiProvider } from "jotai"
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
const getItemMock = vi.fn()
const setItemMock = vi.fn()
const setMetaMock = vi.fn()

function langCodeLabel(langCode: Config["language"]["targetCode"]) {
  return `${LANG_CODE_TO_EN_NAME[langCode]} (${LANG_CODE_TO_LOCALE_NAME[langCode]})`
}

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => key,
  },
  storage: {
    getItem: getItemMock,
    setItem: setItemMock,
    setMeta: setMetaMock,
    watch: vi.fn(() => vi.fn()),
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

function renderApp(config: Config = DEFAULT_CONFIG) {
  getItemMock.mockResolvedValue(config)
  const store = createStore()
  store.set(configAtom, config)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <JotaiProvider store={store}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </JotaiProvider>
    </QueryClientProvider>,
  )

  return {
    store,
    ...renderResult,
  }
}

function getTargetLanguageSelector() {
  return screen.getByRole("combobox", { name: "splitTranslator.targetLanguageLabel" })
}

async function expectTargetLanguage(langCode: Config["language"]["targetCode"]) {
  await waitFor(() => {
    expect(getTargetLanguageSelector()).toHaveTextContent(langCodeLabel(langCode))
  })
}

async function selectTargetLanguage(langCode: Config["language"]["targetCode"]) {
  fireEvent.click(getTargetLanguageSelector())
  const option = await screen.findByRole("option", { name: langCodeLabel(langCode) })
  fireEvent.pointerMove(option, { pointerType: "mouse" })
  fireEvent.mouseMove(option)
  fireEvent.pointerDown(option, { pointerType: "mouse" })
  fireEvent.mouseDown(option)
  fireEvent.click(option)

  await expectTargetLanguage(langCode)
}

describe("split translator app", () => {
  beforeEach(() => {
    translateTextCoreMock.mockReset()
    detectLanguageMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    toastWarningMock.mockReset()
    getItemMock.mockReset()
    setItemMock.mockReset()
    setMetaMock.mockReset()
    detectLanguageMock.mockResolvedValue("eng")
    getItemMock.mockResolvedValue(DEFAULT_CONFIG)
    setItemMock.mockResolvedValue(undefined)
    setMetaMock.mockResolvedValue(undefined)

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

  it("renders a target language selector that defaults to the global target language", () => {
    renderApp()

    expect(screen.getByText("splitTranslator.targetLanguageLabel")).toBeInTheDocument()
    expect(getTargetLanguageSelector()).toBeInTheDocument()
    expect(getTargetLanguageSelector()).toHaveTextContent(langCodeLabel(DEFAULT_CONFIG.language.targetCode))
  })

  it("syncs the selector with config updates after mount until the user chooses a local target language", async () => {
    const persistedConfig: Config = {
      ...DEFAULT_CONFIG,
      language: {
        ...DEFAULT_CONFIG.language,
        targetCode: "eng",
      },
    }
    const { store } = renderApp()

    await expectTargetLanguage(DEFAULT_CONFIG.language.targetCode)

    act(() => {
      store.set(configAtom, persistedConfig)
    })

    await expectTargetLanguage("eng")
  })

  it("keeps a user-selected target language local after queued external target updates", async () => {
    let resolveInitialTranslation: (value: string) => void
    translateTextCoreMock
      .mockReturnValueOnce(new Promise<string>((resolve) => {
        resolveInitialTranslation = resolve
      }))
      .mockResolvedValueOnce("Hello")
      .mockResolvedValueOnce("こんにちは")
    const { store } = renderApp()

    fireEvent.change(screen.getByLabelText("splitTranslator.inputLabel"), { target: { value: "你好" } })
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.translate" }))

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(1)
    })

    act(() => {
      store.set(configAtom, {
        ...DEFAULT_CONFIG,
        language: {
          ...DEFAULT_CONFIG.language,
          targetCode: "eng",
        },
      })
    })

    resolveInitialTranslation!("Bonjour")

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(2)
      expect(translateTextCoreMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
        langConfig: expect.objectContaining({ targetCode: "eng" }),
        text: "你好",
      }))
    })

    await screen.findByText("Hello")
    await selectTargetLanguage("jpn")

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(3)
      expect(translateTextCoreMock).toHaveBeenNthCalledWith(3, expect.objectContaining({
        langConfig: expect.objectContaining({ targetCode: "jpn" }),
        text: "你好",
      }))
    })

    act(() => {
      store.set(configAtom, {
        ...DEFAULT_CONFIG,
        language: {
          ...DEFAULT_CONFIG.language,
          targetCode: "fra",
        },
      })
    })

    await expectTargetLanguage("jpn")
    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(3)
    })
  })

  it("submits text with the currently selected target language", async () => {
    translateTextCoreMock.mockResolvedValue("Hello")
    renderApp()

    await selectTargetLanguage("eng")
    fireEvent.change(screen.getByLabelText("splitTranslator.inputLabel"), { target: { value: "你好" } })
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.translate" }))

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledWith(expect.objectContaining({
        langConfig: expect.objectContaining({ targetCode: "eng" }),
        text: "你好",
      }))
    })
  })

  it("automatically retranslates non-empty input when the target language changes", async () => {
    translateTextCoreMock
      .mockResolvedValueOnce("你好")
      .mockResolvedValueOnce("Hello")
    renderApp()

    fireEvent.change(screen.getByLabelText("splitTranslator.inputLabel"), { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.translate" }))
    await screen.findByText("你好")

    await selectTargetLanguage("eng")

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(2)
      expect(translateTextCoreMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
        langConfig: expect.objectContaining({ targetCode: "eng" }),
        text: "Hello",
      }))
    })
  })

  it("automatically retranslates non-empty input when the global target language changes without a local override", async () => {
    translateTextCoreMock
      .mockResolvedValueOnce("你好")
      .mockResolvedValueOnce("Hello")
    const { store } = renderApp()

    fireEvent.change(screen.getByLabelText("splitTranslator.inputLabel"), { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.translate" }))
    await screen.findByText("你好")

    act(() => {
      store.set(configAtom, {
        ...DEFAULT_CONFIG,
        language: {
          ...DEFAULT_CONFIG.language,
          targetCode: "eng",
        },
      })
    })

    await expectTargetLanguage("eng")
    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(2)
      expect(translateTextCoreMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
        langConfig: expect.objectContaining({ targetCode: "eng" }),
        text: "Hello",
      }))
    })
  })

  it("defers external target-language retranslation until the current request finishes", async () => {
    let resolveFirstTranslation: (value: string) => void
    translateTextCoreMock
      .mockReturnValueOnce(new Promise<string>((resolve) => {
        resolveFirstTranslation = resolve
      }))
      .mockResolvedValueOnce("Hello")
    const { store } = renderApp()

    fireEvent.change(screen.getByLabelText("splitTranslator.inputLabel"), { target: { value: "你好" } })
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.translate" }))

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(1)
    })

    act(() => {
      store.set(configAtom, {
        ...DEFAULT_CONFIG,
        language: {
          ...DEFAULT_CONFIG.language,
          targetCode: "eng",
        },
      })
    })

    await expectTargetLanguage("eng")
    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(1)
    })

    resolveFirstTranslation!("Bonjour")

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(2)
      expect(translateTextCoreMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
        langConfig: expect.objectContaining({ targetCode: "eng" }),
        text: "你好",
      }))
    })
  })

  it("retries with the current selected target language", async () => {
    translateTextCoreMock
      .mockRejectedValueOnce(new Error("Network failed"))
      .mockResolvedValueOnce("Hello")
    renderApp()

    await selectTargetLanguage("eng")
    fireEvent.change(screen.getByLabelText("splitTranslator.inputLabel"), { target: { value: "你好" } })
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.translate" }))

    await waitFor(() => {
      expect(screen.getByText("Network failed")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.retry" }))

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
        langConfig: expect.objectContaining({ targetCode: "eng" }),
        text: "你好",
      }))
      expect(screen.getByText("Hello")).toBeInTheDocument()
    })
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

  it("disables the target language selector while translation is loading", async () => {
    let resolveTranslation: (value: string) => void
    translateTextCoreMock.mockReturnValue(new Promise<string>((resolve) => {
      resolveTranslation = resolve
    }))
    renderApp()

    fireEvent.change(screen.getByLabelText("splitTranslator.inputLabel"), { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.translate" }))

    await waitFor(() => {
      expect(getTargetLanguageSelector()).toBeDisabled()
    })

    resolveTranslation!("Bonjour")
    await screen.findByText("Bonjour")
  })

  it("does not start a second translation when users try to change target language while loading", async () => {
    let resolveTranslation: (value: string) => void
    translateTextCoreMock.mockReturnValue(new Promise<string>((resolve) => {
      resolveTranslation = resolve
    }))
    renderApp()

    fireEvent.change(screen.getByLabelText("splitTranslator.inputLabel"), { target: { value: "Hello" } })
    fireEvent.click(screen.getByRole("button", { name: "splitTranslator.translate" }))

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(1)
      expect(getTargetLanguageSelector()).toBeDisabled()
    })

    fireEvent.click(getTargetLanguageSelector())

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole("option", { name: langCodeLabel("eng") })).not.toBeInTheDocument()

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
