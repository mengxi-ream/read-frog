// @vitest-environment jsdom
import type { ReactElement } from "react"
import type {
  BackgroundStructuredObjectStreamSnapshot,
  BackgroundTextStreamSnapshot,
} from "@/types/background-stream"
import type { Config } from "@/types/config/config"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { isLLMProviderConfig, isTranslateProviderConfig } from "@/types/config/provider"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  buildContextSnapshot,
  createRangeSnapshot,
  normalizeSelectedText,
} from "../../utils"
import { setSelectionStateAtom } from "../atoms"
import { SelectionToolbarCustomActionButtons } from "../custom-action-button"
import { SelectionCustomActionProvider } from "../custom-action-button/provider"
import { SelectionToolbar } from "../index"
import { TranslateButton } from "../translate-button"
import { SelectionTranslationProvider } from "../translate-button/provider"

const streamBackgroundTextMock = vi.fn()
const streamBackgroundStructuredObjectMock = vi.fn()
const translateTextCoreMock = vi.fn()
const getOrFetchArticleDataMock = vi.fn()
const toastErrorMock = vi.fn()
const onMessageMock = vi.fn()
const originalGetSelection = window.getSelection

vi.mock("@/components/ui/selection-popover", async () => {
  const React = await import("react")

  interface PopoverContextValue {
    open: boolean
    onOpenChange?: (open: boolean) => void
  }

  const PopoverContext = React.createContext<PopoverContextValue | null>(null)

  function usePopoverContext() {
    const context = React.use(PopoverContext)
    if (!context) {
      throw new Error("SelectionPopover components must be used within SelectionPopover.Root.")
    }
    return context
  }

  function Root({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode
    open: boolean
    onOpenChange?: (open: boolean) => void
  }) {
    return (
      <PopoverContext value={{ open, onOpenChange }}>
        {children}
      </PopoverContext>
    )
  }

  function Trigger({
    children,
    onClick,
    ...props
  }: React.ComponentProps<"button"> & {
    children: React.ReactNode
  }) {
    const { onOpenChange } = usePopoverContext()
    return (
      <button
        {...props}
        type="button"
        onClick={(event) => {
          onClick?.(event)
          onOpenChange?.(true)
        }}
      >
        {children}
      </button>
    )
  }

  function Content({
    children,
    finalFocus,
  }: {
    children: React.ReactNode
    finalFocus?: boolean
  }) {
    const { open } = usePopoverContext()
    return open
      ? (
          <div
            data-testid="selection-popover-content"
            data-final-focus={finalFocus === false ? "false" : undefined}
            data-rf-selection-overlay-root=""
          >
            {children}
          </div>
        )
      : null
  }

  function Body({
    children,
    ref,
    ...props
  }: React.ComponentProps<"div"> & { ref?: React.Ref<HTMLDivElement> }) {
    return (
      <div ref={ref} {...props}>
        {children}
      </div>
    )
  }

  function Close() {
    const { onOpenChange } = usePopoverContext()
    return (
      <button type="button" aria-label="Close" onClick={() => onOpenChange?.(false)}>
        Close
      </button>
    )
  }

  function Pin() {
    return <button type="button">Pin</button>
  }

  function Footer({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>
  }

  return {
    SelectionPopover: {
      Root,
      Trigger,
      Content,
      Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Body,
      Footer,
      Pin,
      Close,
    },
    useSelectionPopoverOverlayProps: () => ({
      container: undefined,
      positionerClassName: undefined,
    }),
  }
})

vi.mock("../../components/selection-toolbar-title-content", () => ({
  SelectionToolbarTitleContent: ({ title }: { title: string }) => <div>{title}</div>,
}))

vi.mock("../../components/selection-toolbar-footer-content", () => ({
  SelectionToolbarFooterContent: ({
    paragraphsText,
    onProviderChange,
    onRegenerate,
    providers,
    titleText,
    value,
  }: {
    paragraphsText: string | null | undefined
    onProviderChange: (id: string) => void
    onRegenerate: () => void
    providers: Array<{ id: string }>
    titleText: string | null | undefined
    value: string
  }) => {
    const nextProvider = providers.find(provider => provider.id !== value)

    return (
      <div>
        <span data-testid="footer-title">{titleText}</span>
        <span data-testid="footer-paragraphs">{paragraphsText}</span>
        <button type="button" aria-label="Regenerate" onClick={onRegenerate}>
          Regenerate
        </button>
        <button
          type="button"
          aria-label="Change provider"
          disabled={!nextProvider}
          onClick={() => {
            if (nextProvider) {
              onProviderChange(nextProvider.id)
            }
          }}
        >
          Change provider
        </button>
      </div>
    )
  },
}))

vi.mock("../translate-button/translation-content", () => ({
  TranslationContent: ({
    selectionContent,
    translatedText,
    isTranslating,
  }: {
    selectionContent: string | null | undefined
    translatedText: string | undefined
    isTranslating: boolean
  }) => (
    <div data-testid="translation-content">
      <span data-testid="translation-selection">{selectionContent}</span>
      <span data-testid="translation-result">{translatedText ?? ""}</span>
      <span data-testid="translation-status">{String(isTranslating)}</span>
    </div>
  ),
}))

vi.mock("../custom-action-button/structured-object-renderer", () => ({
  StructuredObjectRenderer: ({ value }: { value: Record<string, unknown> | null }) => (
    <pre>{JSON.stringify(value)}</pre>
  ),
}))

vi.mock("@/utils/content-script/background-stream-client", () => ({
  streamBackgroundText: (...args: unknown[]) => streamBackgroundTextMock(...args),
  streamBackgroundStructuredObject: (...args: unknown[]) => streamBackgroundStructuredObjectMock(...args),
}))

vi.mock("@/utils/host/translate/translate-text", () => ({
  translateTextCore: (...args: unknown[]) => translateTextCoreMock(...args),
}))

vi.mock("@/utils/host/translate/article-context", () => ({
  getOrFetchArticleData: (...args: unknown[]) => getOrFetchArticleDataMock(...args),
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: vi.fn(),
  },
}))

vi.mock("@/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/utils/message", () => ({
  onMessage: (...args: unknown[]) => onMessageMock(...args),
  sendMessage: vi.fn(),
}))

function cloneConfig(config: Config): Config {
  return JSON.parse(JSON.stringify(config)) as Config
}

function createRangeFor(node: Node) {
  const range = document.createRange()
  range.selectNodeContents(node)
  return range
}

function createRangeAcrossNodes(
  startNode: Text,
  endNode: Text,
) {
  const range = document.createRange()
  range.setStart(startNode, 0)
  range.setEnd(endNode, endNode.textContent?.length ?? 0)
  return range
}

type TestStore = ReturnType<typeof createStore>

function setSelectionState(
  store: TestStore,
  {
    range,
    text,
  }: {
    range?: Range | null
    text?: string | null
  },
) {
  if (text === undefined && !range) {
    store.set(setSelectionStateAtom, { selection: null, context: null })
    return
  }

  const normalizedText = text !== undefined
    ? normalizeSelectedText(text)
    : normalizeSelectedText(range?.toString())
  const selection = {
    text: normalizedText,
    ranges: range ? [createRangeSnapshot(range)] : [],
  }

  store.set(setSelectionStateAtom, {
    selection,
    context: selection.ranges.length > 0 && selection.text !== ""
      ? buildContextSnapshot(selection)
      : null,
  })
}

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

function mockWindowSelection(range: Range | null) {
  window.getSelection = vi.fn(() => {
    if (!range) {
      return null
    }

    return {
      anchorNode: range.startContainer,
      focusNode: range.endContainer,
      rangeCount: 1,
      toString: () => range.toString(),
      getRangeAt: () => range,
      containsNode: vi.fn(() => false),
    } as unknown as Selection
  }) as unknown as typeof window.getSelection
}

function getRegisteredMessageHandler<T>(name: string) {
  const registration = onMessageMock.mock.calls.find(call => call[0] === name)
  if (!registration) {
    throw new Error(`Message handler not registered: ${name}`)
  }

  return registration[1] as (message: { data: T }) => void
}

function createStructuredObjectSnapshot(output: Record<string, unknown>): BackgroundStructuredObjectStreamSnapshot {
  return {
    output,
    thinking: {
      status: "complete",
      text: "",
    },
  }
}

function findAlternateTranslateProviderId(config: Config, currentProviderId: string) {
  return config.providersConfig.find(provider =>
    provider.id !== currentProviderId && isTranslateProviderConfig(provider),
  )?.id
}

function findAlternateLLMProviderId(config: Config, currentProviderId: string) {
  return config.providersConfig.find(provider =>
    provider.id !== currentProviderId && isLLMProviderConfig(provider),
  )?.id
}

function setSelectionToolbarTranslateProvider(config: Config, providerId: string) {
  config.selectionToolbar.features.translate.providerId = providerId
}

function renderWithProviders(ui: ReactElement, store = createStore()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const view = render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <TooltipProvider>
          <SelectionTranslationProvider>
            <SelectionCustomActionProvider>
              {ui}
            </SelectionCustomActionProvider>
          </SelectionTranslationProvider>
        </TooltipProvider>
      </Provider>
    </QueryClientProvider>,
  )

  return {
    ...view,
    queryClient,
    store,
  }
}

async function openTooltip(trigger: HTMLElement) {
  fireEvent.mouseEnter(trigger)
  fireEvent.focus(trigger)

  await waitFor(() => {
    expect(document.querySelector("[data-slot='tooltip-content']")).toBeTruthy()
  })
}

describe("selection toolbar requests", () => {
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ""
    window.getSelection = originalGetSelection
    vi.resetAllMocks()
  })

  it("does not rerun translation on passive config refresh, but reruns when request values change", async () => {
    translateTextCoreMock.mockResolvedValue("translated once")
    getOrFetchArticleDataMock.mockResolvedValue(null)

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, { text: "Selected text" })
    const view = renderWithProviders(<TranslateButton />, store)

    fireEvent.click(screen.getByRole("button", { name: "action.translation" }))

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(1)
    })

    const refreshedConfig = cloneConfig(store.get(configAtom))
    act(() => {
      store.set(configAtom, refreshedConfig)
    })
    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        <Provider store={store}>
          <TooltipProvider>
            <SelectionTranslationProvider>
              <SelectionCustomActionProvider>
                <TranslateButton />
              </SelectionCustomActionProvider>
            </SelectionTranslationProvider>
          </TooltipProvider>
        </Provider>
      </QueryClientProvider>,
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(translateTextCoreMock).toHaveBeenCalledTimes(1)

    const updatedConfig = cloneConfig(store.get(configAtom))
    const nextProviderId = findAlternateTranslateProviderId(
      updatedConfig,
      updatedConfig.selectionToolbar.features.translate.providerId,
    )
    if (!nextProviderId) {
      throw new Error("No alternate translate provider available for test")
    }
    updatedConfig.selectionToolbar.features.translate.providerId = nextProviderId

    act(() => {
      store.set(configAtom, updatedConfig)
    })

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(2)
    })

    expect(translateTextCoreMock.mock.calls[1]?.[0]).toMatchObject({
      providerConfig: expect.objectContaining({
        id: nextProviderId,
      }),
    })

    await waitFor(() => {
      expect(screen.getByTestId("translation-status").textContent).toBe("false")
    })
  })

  it("renders the translation tooltip as non-interactive and closes it on hover leave", async () => {
    translateTextCoreMock.mockResolvedValue("translated once")
    getOrFetchArticleDataMock.mockResolvedValue(null)

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, { text: "Selected text" })
    renderWithProviders(<TranslateButton />, store)

    const trigger = screen.getByRole("button", { name: "action.translation" })
    await openTooltip(trigger)

    const tooltip = document.querySelector("[data-slot='tooltip-content']")
    expect(tooltip).toHaveTextContent("action.translation")
    expect(tooltip).toHaveClass("pointer-events-none")

    fireEvent.mouseLeave(trigger)
    fireEvent.blur(trigger)
    await waitFor(() => {
      expect(document.querySelector("[data-slot='tooltip-content']")).toBeNull()
    })
  })

  it("opts out of focus restoration when closing the translation popover", async () => {
    translateTextCoreMock.mockResolvedValue("translated once")
    getOrFetchArticleDataMock.mockResolvedValue(null)

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, { text: "Selected text" })
    renderWithProviders(<TranslateButton />, store)

    fireEvent.click(screen.getByRole("button", { name: "action.translation" }))

    await waitFor(() => {
      expect(screen.getByTestId("selection-popover-content")).toHaveAttribute("data-final-focus", "false")
    })
  })

  it("reruns standard translation from the footer and ignores stale results from older runs", async () => {
    const firstRun = createDeferredPromise<string>()
    const secondRun = createDeferredPromise<string>()

    translateTextCoreMock
      .mockImplementationOnce(() => firstRun.promise)
      .mockImplementationOnce(() => secondRun.promise)
    getOrFetchArticleDataMock.mockResolvedValue(null)

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, { text: "Selected text" })
    renderWithProviders(<TranslateButton />, store)

    fireEvent.click(screen.getByRole("button", { name: "action.translation" }))

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }))

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(2)
    })

    await act(async () => {
      firstRun.resolve("stale result")
      await Promise.resolve()
    })

    expect(screen.getByTestId("translation-result").textContent).toBe("")
    expect(screen.getByTestId("translation-status").textContent).toBe("true")

    await act(async () => {
      secondRun.resolve("fresh result")
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByTestId("translation-result").textContent).toBe("fresh result")
    })
    expect(screen.getByTestId("translation-status").textContent).toBe("false")
  })

  it("keeps the original page selection session when selecting text inside the translation popover", async () => {
    translateTextCoreMock.mockResolvedValue("Overlay panel content")
    getOrFetchArticleDataMock.mockResolvedValue(null)

    const paragraph = document.createElement("p")
    paragraph.textContent = "Original page paragraph with surrounding context."
    document.body.appendChild(paragraph)

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, {
      text: "Original page selection",
      range: createRangeFor(paragraph),
    })
    renderWithProviders(<SelectionToolbar />, store)

    const toolbarTranslateButton = document.querySelector<HTMLButtonElement>("button[aria-label='action.translation']")
    if (!toolbarTranslateButton) {
      throw new Error("Selection toolbar translate trigger is missing")
    }

    fireEvent.click(toolbarTranslateButton)

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.getByTestId("translation-result").textContent).toBe("Overlay panel content")
    })
    expect(screen.getByTestId("footer-paragraphs").textContent).toBe("Original page paragraph with surrounding context.")

    const overlayText = screen.getByTestId("translation-result")
    const overlaySelectionRange = createRangeFor(overlayText)
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0)
        return 0
      })

    mockWindowSelection(overlaySelectionRange)

    fireEvent.mouseDown(overlayText)
    document.dispatchEvent(new Event("selectionchange"))
    fireEvent.mouseUp(overlayText)

    await act(async () => {
      await Promise.resolve()
    })

    requestAnimationFrameSpy.mockRestore()

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    fireEvent.click(toolbarTranslateButton)

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(2)
    })

    expect(translateTextCoreMock.mock.calls[0]?.[0]).toMatchObject({
      text: "Original page selection",
    })
    expect(translateTextCoreMock.mock.calls[1]?.[0]).toMatchObject({
      text: "Original page selection",
    })
    expect(screen.getByTestId("footer-paragraphs").textContent).toBe("Original page paragraph with surrounding context.")
  })

  it("aborts llm translations when the popover closes without surfacing an error", async () => {
    const streamCalls: Array<{ signal?: AbortSignal, onChunk?: (data: BackgroundTextStreamSnapshot) => void }> = []
    translateTextCoreMock.mockResolvedValue("")

    streamBackgroundTextMock.mockImplementation((_payload, options: {
      signal?: AbortSignal
      onChunk?: (data: BackgroundTextStreamSnapshot) => void
    }) => {
      streamCalls.push({ signal: options.signal, onChunk: options.onChunk })

      return new Promise<BackgroundTextStreamSnapshot>((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"))
        })
      })
    })

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, { text: "Selected text" })
    renderWithProviders(<TranslateButton />, store)

    const updatedConfig = cloneConfig(store.get(configAtom))
    setSelectionToolbarTranslateProvider(updatedConfig, "openai-default")
    act(() => {
      store.set(configAtom, updatedConfig)
    })

    fireEvent.click(screen.getByRole("button", { name: "action.translation" }))

    await waitFor(() => {
      expect(streamBackgroundTextMock).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    expect(streamCalls[0]?.signal?.aborted).toBe(true)

    await act(async () => {
      await Promise.resolve()
    })

    expect(toastErrorMock).not.toHaveBeenCalled()
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByTestId("translation-content")).toBeNull()
  })

  it("renders translate errors inline and clears them after a successful rerun", async () => {
    translateTextCoreMock
      .mockRejectedValueOnce(new Error("Standard translation failed"))
      .mockResolvedValueOnce("Recovered translation")
    getOrFetchArticleDataMock.mockResolvedValue(null)

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, { text: "Selected text" })
    renderWithProviders(<TranslateButton />, store)

    fireEvent.click(screen.getByRole("button", { name: "action.translation" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("translationHub.translationFailed")
    expect(alert).toHaveTextContent("Standard translation failed")
    expect(toastErrorMock).not.toHaveBeenCalled()

    const translationContent = screen.getByTestId("translation-content")
    expect(translationContent.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(alert.compareDocumentPosition(screen.getByRole("button", { name: "Change provider" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }))

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(2)
    })

    await waitFor(() => {
      expect(screen.getByTestId("translation-result").textContent).toBe("Recovered translation")
    })
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("shows a precheck alert when the translate provider is unavailable", async () => {
    const store = createStore()
    const updatedConfig = cloneConfig(DEFAULT_CONFIG)
    updatedConfig.selectionToolbar.features.translate.providerId = "missing-provider-id"

    store.set(configAtom, updatedConfig)
    setSelectionState(store, { text: "Selected text" })
    renderWithProviders(<TranslateButton />, store)

    fireEvent.click(screen.getByRole("button", { name: "action.translation" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("translationHub.translationFailed")
    expect(alert).toHaveTextContent("options.floatingButtonAndToolbar.selectionToolbar.errors.providerUnavailable")
    expect(translateTextCoreMock).not.toHaveBeenCalled()
    expect(streamBackgroundTextMock).not.toHaveBeenCalled()
  })

  it("shows translations identical to the original text", async () => {
    translateTextCoreMock.mockResolvedValue("Selected text")
    getOrFetchArticleDataMock.mockResolvedValue(null)

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, { text: "Selected text" })
    renderWithProviders(<TranslateButton />, store)

    fireEvent.click(screen.getByRole("button", { name: "action.translation" }))

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getByTestId("translation-status").textContent).toBe("false")
    })

    expect(screen.getByTestId("translation-result").textContent).toBe("Selected text")
  })

  it("opens selection translation from the context menu and tracks the context-menu surface", async () => {
    translateTextCoreMock.mockResolvedValue("Context menu result")
    getOrFetchArticleDataMock.mockResolvedValue(null)

    const paragraph = document.createElement("p")
    paragraph.textContent = "Selected text inside a paragraph."
    document.body.appendChild(paragraph)

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, { text: "Selected text", range: createRangeFor(paragraph) })
    renderWithProviders(<TranslateButton />, store)

    act(() => {
      paragraph.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        button: 2,
        clientX: 140,
        clientY: 180,
      }))
    })

    const handler = getRegisteredMessageHandler("openSelectionTranslationFromContextMenu")

    await act(async () => {
      handler({ data: { selectionText: "Selected text" } })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getByTestId("translation-result").textContent).toBe("Context menu result")
    })

    const { sendMessage } = await import("@/utils/message")
    expect(vi.mocked(sendMessage)).toHaveBeenCalledWith(
      "trackFeatureUsedEvent",
      expect.objectContaining({
        feature: "selection_translation",
        surface: "context_menu",
        outcome: "success",
      }),
    )
  })

  it("reuses the same captured session for cross-node context-menu translation", async () => {
    translateTextCoreMock.mockResolvedValue("Cross-node result")
    getOrFetchArticleDataMock.mockResolvedValue(null)

    const container = document.createElement("div")
    const firstBlock = document.createElement("div")
    firstBlock.textContent = "As long as you're alive,"
    const secondBlock = document.createElement("div")
    secondBlock.textContent = "there's no bad ending."
    container.append(firstBlock, secondBlock)
    document.body.appendChild(container)

    const startNode = firstBlock.firstChild
    const endNode = secondBlock.firstChild
    if (!(startNode instanceof Text) || !(endNode instanceof Text)) {
      throw new TypeError("Expected text nodes for cross-node selection test")
    }

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, {
      text: "As long as you're alive, there's no bad ending.",
      range: createRangeAcrossNodes(startNode, endNode),
    })
    renderWithProviders(<TranslateButton />, store)

    act(() => {
      container.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        button: 2,
        clientX: 180,
        clientY: 220,
      }))
    })

    const handler = getRegisteredMessageHandler("openSelectionTranslationFromContextMenu")

    await act(async () => {
      handler({
        data: {
          selectionText: "As long as you're alive,\nthere's no bad ending.",
        },
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(translateTextCoreMock).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByTestId("translation-selection").textContent).toBe(
      "As long as you're alive, there's no bad ending.",
    )
    expect(screen.getByTestId("footer-paragraphs").textContent).toContain("As long as you're alive,")
    expect(screen.getByTestId("footer-paragraphs").textContent).toContain("there's no bad ending.")
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it("shows a toast when the context menu request cannot recover a selection snapshot", async () => {
    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    renderWithProviders(<TranslateButton />, store)

    const handler = getRegisteredMessageHandler<{ selectionText: string }>("openSelectionTranslationFromContextMenu")

    act(() => {
      handler({ data: { selectionText: "Missing selection" } })
    })

    expect(toastErrorMock).toHaveBeenCalledWith(
      "options.floatingButtonAndToolbar.selectionToolbar.errors.missingSelection",
    )
    expect(translateTextCoreMock).not.toHaveBeenCalled()
  })

  it("opens a custom action from the context menu with the captured selection session", async () => {
    streamBackgroundStructuredObjectMock.mockResolvedValue(createStructuredObjectSnapshot({ summary: "Context menu result" }))

    const paragraph = document.createElement("p")
    paragraph.textContent = "Selected text inside a paragraph."
    document.body.appendChild(paragraph)

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, { text: "Selected text", range: createRangeFor(paragraph) })
    renderWithProviders(<SelectionToolbarCustomActionButtons />, store)

    const action = DEFAULT_CONFIG.selectionToolbar.customActions[0]
    if (!action) {
      throw new Error("Default custom action is missing")
    }

    act(() => {
      paragraph.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        button: 2,
        clientX: 140,
        clientY: 180,
      }))
    })

    const handler = getRegisteredMessageHandler<{ actionId: string, selectionText: string }>(
      "openSelectionCustomActionFromContextMenu",
    )

    await act(async () => {
      handler({
        data: {
          actionId: action.id,
          selectionText: "Selected text",
        },
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(streamBackgroundStructuredObjectMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getByText("{\"summary\":\"Context menu result\"}")).toBeInTheDocument()
    })

    expect(screen.getByTestId("footer-paragraphs").textContent).toContain("Selected text inside a paragraph.")
    expect(toastErrorMock).not.toHaveBeenCalled()

    const { sendMessage } = await import("@/utils/message")
    expect(vi.mocked(sendMessage)).toHaveBeenCalledWith(
      "trackFeatureUsedEvent",
      expect.objectContaining({
        feature: "custom_ai_action",
        surface: "context_menu",
        outcome: "success",
        action_id: action.id,
        action_name: action.name,
      }),
    )
  })

  it("renders the custom action tooltip as non-interactive and closes it on hover leave", async () => {
    streamBackgroundStructuredObjectMock.mockResolvedValue(
      createStructuredObjectSnapshot({ summary: "done" }),
    )

    const actionName = DEFAULT_CONFIG.selectionToolbar.customActions[0]?.name
    if (!actionName) {
      throw new Error("Default custom action is missing")
    }

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, { text: "Selected text" })
    renderWithProviders(<SelectionToolbarCustomActionButtons />, store)

    const trigger = screen.getByRole("button", { name: actionName })
    await openTooltip(trigger)

    const tooltip = document.querySelector("[data-slot='tooltip-content']")
    expect(tooltip).toHaveTextContent(actionName)
    expect(tooltip).toHaveClass("pointer-events-none")

    fireEvent.mouseLeave(trigger)
    fireEvent.blur(trigger)
    await waitFor(() => {
      expect(document.querySelector("[data-slot='tooltip-content']")).toBeNull()
    })
  })

  it("shows a toast when a custom action context menu request cannot recover a selection snapshot", async () => {
    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    renderWithProviders(<SelectionToolbarCustomActionButtons />, store)

    const action = DEFAULT_CONFIG.selectionToolbar.customActions[0]
    if (!action) {
      throw new Error("Default custom action is missing")
    }

    const handler = getRegisteredMessageHandler<{ actionId: string, selectionText: string }>(
      "openSelectionCustomActionFromContextMenu",
    )

    act(() => {
      handler({
        data: {
          actionId: action.id,
          selectionText: "Missing selection",
        },
      })
    })

    expect(toastErrorMock).toHaveBeenCalledWith(
      "options.floatingButtonAndToolbar.selectionToolbar.errors.missingSelection",
    )
    expect(streamBackgroundStructuredObjectMock).not.toHaveBeenCalled()

    const { sendMessage } = await import("@/utils/message")
    expect(vi.mocked(sendMessage)).toHaveBeenCalledWith(
      "trackFeatureUsedEvent",
      expect.objectContaining({
        feature: "custom_ai_action",
        surface: "context_menu",
        outcome: "failure",
        action_id: action.id,
        action_name: action.name,
      }),
    )
  })

  it("does not rerun custom action requests on passive config refresh, but reruns when request values change", async () => {
    streamBackgroundStructuredObjectMock.mockResolvedValue(createStructuredObjectSnapshot({ summary: "done" }))

    const paragraph = document.createElement("p")
    paragraph.textContent = "Selected text inside a paragraph."
    document.body.appendChild(paragraph)

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, { text: "Selected text", range: createRangeFor(paragraph) })
    renderWithProviders(<SelectionToolbarCustomActionButtons />, store)

    const actionName = DEFAULT_CONFIG.selectionToolbar.customActions[0]?.name
    if (!actionName) {
      throw new Error("Default custom action is missing")
    }

    fireEvent.click(screen.getByRole("button", { name: actionName }))

    await waitFor(() => {
      expect(streamBackgroundStructuredObjectMock).toHaveBeenCalledTimes(1)
    })

    act(() => {
      store.set(configAtom, cloneConfig(store.get(configAtom)))
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(streamBackgroundStructuredObjectMock).toHaveBeenCalledTimes(1)

    const updatedConfig = cloneConfig(store.get(configAtom))
    const currentProviderId = updatedConfig.selectionToolbar.customActions[0]?.providerId ?? ""
    const nextProviderId = findAlternateLLMProviderId(updatedConfig, currentProviderId)
    if (!nextProviderId) {
      throw new Error("No alternate LLM provider available for custom action test")
    }
    updatedConfig.selectionToolbar.customActions[0] = {
      ...updatedConfig.selectionToolbar.customActions[0]!,
      providerId: nextProviderId,
    }

    act(() => {
      store.set(configAtom, updatedConfig)
    })

    await waitFor(() => {
      expect(streamBackgroundStructuredObjectMock).toHaveBeenCalledTimes(2)
    })
  })

  it("reruns custom action requests from the footer and aborts the previous run", async () => {
    const firstRun = createDeferredPromise<BackgroundStructuredObjectStreamSnapshot>()
    const secondRun = createDeferredPromise<BackgroundStructuredObjectStreamSnapshot>()
    const signals: AbortSignal[] = []

    streamBackgroundStructuredObjectMock
      .mockImplementationOnce((_payload, options: { signal?: AbortSignal }) => {
        signals.push(options.signal as AbortSignal)
        options.signal?.addEventListener("abort", () => {
          firstRun.reject(new DOMException("aborted", "AbortError"))
        })
        return firstRun.promise
      })
      .mockImplementationOnce((_payload, options: { signal?: AbortSignal }) => {
        signals.push(options.signal as AbortSignal)
        return secondRun.promise
      })

    const paragraph = document.createElement("p")
    paragraph.textContent = "Selected text inside a paragraph."
    document.body.appendChild(paragraph)

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, { text: "Selected text", range: createRangeFor(paragraph) })
    renderWithProviders(<SelectionToolbarCustomActionButtons />, store)

    const actionName = DEFAULT_CONFIG.selectionToolbar.customActions[0]?.name
    if (!actionName) {
      throw new Error("Default custom action is missing")
    }

    fireEvent.click(screen.getByRole("button", { name: actionName }))

    await waitFor(() => {
      expect(streamBackgroundStructuredObjectMock).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }))

    await waitFor(() => {
      expect(streamBackgroundStructuredObjectMock).toHaveBeenCalledTimes(2)
    })

    expect(signals[0]?.aborted).toBe(true)

    await act(async () => {
      secondRun.resolve(createStructuredObjectSnapshot({ summary: "fresh" }))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByText("{\"summary\":\"fresh\"}")).toBeInTheDocument()
    })
  })

  it("shows a precheck alert when a custom action has no selected text", async () => {
    const paragraph = document.createElement("p")
    paragraph.textContent = "Selected text inside a paragraph."
    document.body.appendChild(paragraph)

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, { text: "   ", range: createRangeFor(paragraph) })
    renderWithProviders(<SelectionToolbarCustomActionButtons />, store)

    const actionName = DEFAULT_CONFIG.selectionToolbar.customActions[0]?.name
    if (!actionName) {
      throw new Error("Default custom action is missing")
    }

    fireEvent.click(screen.getByRole("button", { name: actionName }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("options.floatingButtonAndToolbar.selectionToolbar.errors.customActionFailed")
    expect(alert).toHaveTextContent("options.floatingButtonAndToolbar.selectionToolbar.errors.missingSelection")
    expect(streamBackgroundStructuredObjectMock).not.toHaveBeenCalled()

    const { sendMessage } = await import("@/utils/message")
    expect(vi.mocked(sendMessage)).toHaveBeenCalledWith(
      "trackFeatureUsedEvent",
      expect.objectContaining({
        feature: "custom_ai_action",
        surface: "selection_toolbar",
        outcome: "failure",
        action_id: DEFAULT_CONFIG.selectionToolbar.customActions[0]?.id,
        action_name: DEFAULT_CONFIG.selectionToolbar.customActions[0]?.name,
      }),
    )
  })

  it("renders custom action errors inline and clears them after a successful rerun", async () => {
    streamBackgroundStructuredObjectMock
      .mockRejectedValueOnce(new Error("Structured output failed"))
      .mockResolvedValueOnce(createStructuredObjectSnapshot({ summary: "fresh" }))

    const paragraph = document.createElement("p")
    paragraph.textContent = "Selected text inside a paragraph."
    document.body.appendChild(paragraph)

    const store = createStore()
    store.set(configAtom, cloneConfig(DEFAULT_CONFIG))
    setSelectionState(store, { text: "Selected text", range: createRangeFor(paragraph) })
    renderWithProviders(<SelectionToolbarCustomActionButtons />, store)

    const actionName = DEFAULT_CONFIG.selectionToolbar.customActions[0]?.name
    if (!actionName) {
      throw new Error("Default custom action is missing")
    }

    fireEvent.click(screen.getByRole("button", { name: actionName }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("options.floatingButtonAndToolbar.selectionToolbar.errors.customActionFailed")
    expect(alert).toHaveTextContent("Structured output failed")

    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }))

    await waitFor(() => {
      expect(streamBackgroundStructuredObjectMock).toHaveBeenCalledTimes(2)
    })

    await waitFor(() => {
      expect(screen.getByText("{\"summary\":\"fresh\"}")).toBeInTheDocument()
    })
    expect(screen.queryByRole("alert")).toBeNull()
  })
})
