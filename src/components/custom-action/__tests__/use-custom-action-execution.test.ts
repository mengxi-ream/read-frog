import type { CachedWebPageContext } from "@/utils/host/translate/webpage-context"
// @vitest-environment jsdom
import { act, render, renderHook, screen, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ANALYTICS_SURFACE } from "@/types/analytics"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CUSTOM_ACTION_CONTEXT_CHAR_LIMIT } from "@/utils/custom-action-prompt"
import { findSelectionToolbarAction, getBuiltInDictionaryAction } from "@/utils/custom-actions"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"
import {
  buildCustomActionExecutionPlan,
  useCustomActionExecution,
  useCustomActionWebPageContext,
} from "../use-custom-action-execution"

const streamBackgroundStructuredObjectMock = vi.fn<(...args: any[]) => any>()

vi.mock("@/utils/content-script/background-stream-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/utils/content-script/background-stream-client")
  >("@/utils/content-script/background-stream-client")

  return {
    ...actual,
    streamBackgroundStructuredObject: (...args: unknown[]) =>
      streamBackgroundStructuredObjectMock(...args),
  }
})

vi.mock("@/utils/analytics", async () => {
  const actual = await vi.importActual<typeof import("@/utils/analytics")>("@/utils/analytics")
  return { ...actual, trackFeatureUsed: vi.fn<(...args: any[]) => any>() }
})

const getOrCreateWebPageContextMock = vi.fn<(...args: any[]) => any>()

vi.mock("@/utils/host/translate/webpage-context", async () => {
  const actual = await vi.importActual<typeof import("@/utils/host/translate/webpage-context")>(
    "@/utils/host/translate/webpage-context",
  )

  return {
    ...actual,
    getOrCreateWebPageContext: (...args: unknown[]) => getOrCreateWebPageContextMock(...args),
  }
})

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void
  let reject!: (error?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, resolve, reject }
}

function WebPageContextProbe({
  open,
  popoverSessionKey,
}: {
  open: boolean
  popoverSessionKey: number
}) {
  const webPageContext = useCustomActionWebPageContext(open, popoverSessionKey)
  const status =
    webPageContext === undefined
      ? "pending"
      : webPageContext === null
        ? "null"
        : webPageContext.webTitle

  return createElement("div", { "data-testid": "web-page-context" }, status)
}

function createCustomActionRequest() {
  const action = getBuiltInDictionaryAction(DEFAULT_CONFIG.selectionToolbar)

  const provider = resolveProviderRefForCapability(
    "customAction",
    DEFAULT_CONFIG.providersConfig,
    action.providerId,
  )

  if (!provider) {
    throw new Error("Default custom action provider must be available")
  }

  return {
    language: DEFAULT_CONFIG.language,
    action,
    provider,
  }
}

describe("useCustomActionWebPageContext", () => {
  beforeEach(() => {
    getOrCreateWebPageContextMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("ignores stale pending results after the popover closes and reopens", async () => {
    const firstRequest = createDeferredPromise<CachedWebPageContext | null>()
    const secondRequest = createDeferredPromise<CachedWebPageContext | null>()

    getOrCreateWebPageContextMock
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise)

    const { rerender } = render(
      createElement(WebPageContextProbe, { open: true, popoverSessionKey: 0 }),
    )

    expect(screen.getByTestId("web-page-context")).toHaveTextContent("pending")

    rerender(createElement(WebPageContextProbe, { open: false, popoverSessionKey: 0 }))
    rerender(createElement(WebPageContextProbe, { open: true, popoverSessionKey: 1 }))

    expect(screen.getByTestId("web-page-context")).toHaveTextContent("pending")

    await act(async () => {
      firstRequest.resolve({
        url: "https://example.com/first",
        webTitle: "First page",
        webContent: "First content",
      })
      await Promise.resolve()
    })

    expect(screen.getByTestId("web-page-context")).toHaveTextContent("pending")

    await act(async () => {
      secondRequest.resolve({
        url: "https://example.com/second",
        webTitle: "Second page",
        webContent: "Second content",
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByTestId("web-page-context")).toHaveTextContent("Second page")
    })
  })

  it("returns to loading for a new popover session even when the previous session already resolved", async () => {
    const firstRequest = createDeferredPromise<CachedWebPageContext | null>()
    const secondRequest = createDeferredPromise<CachedWebPageContext | null>()

    getOrCreateWebPageContextMock
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise)

    const { rerender } = render(
      createElement(WebPageContextProbe, { open: true, popoverSessionKey: 0 }),
    )

    await act(async () => {
      firstRequest.resolve({
        url: "https://example.com/first",
        webTitle: "First page",
        webContent: "First content",
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByTestId("web-page-context")).toHaveTextContent("First page")
    })

    rerender(createElement(WebPageContextProbe, { open: false, popoverSessionKey: 0 }))
    rerender(createElement(WebPageContextProbe, { open: true, popoverSessionKey: 1 }))

    expect(screen.getByTestId("web-page-context")).toHaveTextContent("pending")

    await act(async () => {
      secondRequest.resolve({
        url: "https://example.com/second",
        webTitle: "Second page",
        webContent: "Second content",
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByTestId("web-page-context")).toHaveTextContent("Second page")
    })
  })
})

describe("buildCustomActionExecutionPlan", () => {
  it("truncates paragraph context tokens and trusts the canonical webpage content", () => {
    const contextText = "x".repeat(CUSTOM_ACTION_CONTEXT_CHAR_LIMIT + 128)
    const webPageContext: CachedWebPageContext = {
      url: "https://example.com/article",
      webTitle: "Example page",
      webContent: "y".repeat(CUSTOM_ACTION_CONTEXT_CHAR_LIMIT),
    }
    const plan = buildCustomActionExecutionPlan(
      createCustomActionRequest(),
      "Selected text",
      contextText,
      webPageContext,
    )

    expect(plan.error).toBeNull()
    expect(plan.executionContext?.promptTokens.paragraphs).toBe(
      contextText.slice(0, CUSTOM_ACTION_CONTEXT_CHAR_LIMIT),
    )
    expect(plan.executionContext?.promptTokens.webContent).toBe(webPageContext.webContent)
    expect(plan.executionContext?.promptTokens.selection).toBe("Selected text")
    expect(plan.executionContext?.promptTokens.webUrl).toBe(webPageContext.url)
  })

  it("falls back to the live location when the webpage context is unavailable", () => {
    const plan = buildCustomActionExecutionPlan(
      createCustomActionRequest(),
      "Selected text",
      "context",
      null,
    )

    expect(plan.error).toBeNull()
    expect(plan.executionContext?.promptTokens.webUrl).toBe(window.location.href)
  })
})

describe("useCustomActionExecution", () => {
  it("never asks the model for a selection field, and fills it into every answer", async () => {
    const action = findSelectionToolbarAction(
      DEFAULT_CONFIG.selectionToolbar,
      "default-sentence-analysis",
    )
    if (!action) throw new Error("the built-in Sentence Analysis must exist")
    const provider = resolveProviderRefForCapability(
      "customAction",
      DEFAULT_CONFIG.providersConfig,
      action.providerId,
    )
    if (!provider) throw new Error("its provider must be available")
    const [sentence, annotations, translation] = action.outputSchema.map((field) => field.name)
    const selection = "Only then did she turn the offer down."

    const chunks: unknown[] = []
    streamBackgroundStructuredObjectMock.mockImplementation(
      async (_payload: unknown, { onChunk }: { onChunk: (snapshot: unknown) => void }) => {
        onChunk({ output: { [annotations!]: "[" }, thinking: { status: "thinking", text: "" } })
        return {
          output: { [annotations!]: "[]", [translation!]: "直到那时她才拒绝。" },
          thinking: { status: "complete", text: "" },
        }
      },
    )

    const { result } = renderHook(() => {
      const execution = useCustomActionExecution({
        analyticsSurface: ANALYTICS_SURFACE.SELECTION_TOOLBAR,
        bodyRef: { current: null },
        executionContext: {
          action,
          provider,
          targetCode: "cmn",
          promptTokens: {
            selection,
            paragraphs: selection,
            targetLanguage: "Simplified Chinese",
            webTitle: "",
            webUrl: "https://example.com",
            webContent: "",
          },
        },
        open: true,
        popoverSessionKey: 1,
        rerunNonce: 0,
      })
      chunks.push(execution.result)
      return execution
    })

    await waitFor(() => expect(result.current.isRunning).toBe(false))
    expect(result.current.result).toEqual({
      [annotations!]: "[]",
      [translation!]: "直到那时她才拒绝。",
      [sentence!]: selection,
    })
    // The partial answer already holds it, so the card never loses the sentence.
    expect(chunks).toContainEqual({ [annotations!]: "[", [sentence!]: selection })

    const [payload] = streamBackgroundStructuredObjectMock.mock.calls[0]!
    expect(payload.outputSchema).toEqual([
      { name: annotations, type: "string" },
      { name: translation, type: "string" },
    ])
    expect(payload.instructions).not.toContain(`- key: ${JSON.stringify(sentence)}`)
  })
})
