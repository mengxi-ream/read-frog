import type { CachedWebPageContext } from "@/utils/host/translate/webpage-context"
// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isLLMProviderConfig } from "@/types/config/provider"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CUSTOM_ACTION_CONTEXT_CHAR_LIMIT } from "../../../utils"
import { buildCustomActionExecutionPlan, useCustomActionWebPageContext } from "../use-custom-action-execution"

const getOrCreateWebPageContextMock = vi.fn()

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
  const status = webPageContext === undefined
    ? "pending"
    : webPageContext === null
      ? "null"
      : webPageContext.webTitle

  return createElement("div", { "data-testid": "web-page-context" }, status)
}

function createCustomActionRequest() {
  const action = DEFAULT_CONFIG.selectionToolbar.customActions[0]
  if (!action) {
    throw new Error("Default custom action is missing")
  }

  const providerConfig = DEFAULT_CONFIG.providersConfig.find(provider =>
    provider.id === action.providerId,
  )

  if (!providerConfig || !isLLMProviderConfig(providerConfig)) {
    throw new Error("Default custom action provider must be an enabled LLM provider")
  }

  return {
    language: DEFAULT_CONFIG.language,
    action,
    providerConfig,
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

    const { rerender } = render(createElement(WebPageContextProbe, { open: true, popoverSessionKey: 0 }))

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

    const { rerender } = render(createElement(WebPageContextProbe, { open: true, popoverSessionKey: 0 }))

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
    expect(plan.executionContext?.promptTokens.webContent).toBe(
      webPageContext.webContent,
    )
    expect(plan.executionContext?.promptTokens.selection).toBe("Selected text")
  })
})
