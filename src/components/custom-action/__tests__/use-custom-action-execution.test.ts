import type { CustomActionExecutionContext } from "../use-custom-action-execution"
import type { CachedWebPageContext } from "@/utils/host/translate/webpage-context"
import type { HostedAiStatus, HostedAiTierStatus } from "@/utils/hosted-ai/types"
// @vitest-environment jsdom
import { act, render, renderHook, screen, waitFor } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ANALYTICS_PROVIDER, ANALYTICS_SURFACE } from "@/types/analytics"
import { trackFeatureUsed } from "@/utils/analytics"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { StreamPortError } from "@/utils/content-script/port-streaming"
import { CUSTOM_ACTION_CONTEXT_CHAR_LIMIT } from "@/utils/custom-action-prompt"
import { findSelectionToolbarAction, getBuiltInDictionaryAction } from "@/utils/custom-actions"
import { logInAction, upgradeAction } from "@/utils/error-action"
import {
  BUILT_IN_AI_PROVIDER_ID,
  resolveProviderRefForCapability,
} from "@/utils/providers/provider-registry"
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

describe("useCustomActionExecution with a provider that has no API key", () => {
  const OPENAI_ID = "openai-default"
  const dictionary = getBuiltInDictionaryAction(DEFAULT_CONFIG.selectionToolbar)
  const answer = { definition: "a small amphibian" }

  function missingApiKeyError() {
    // As the background relays an AI_LoadAPIKeyError: classified, message only.
    return new StreamPortError({
      message: "OpenAI API key is missing.",
      reason: "missing_api_key",
    })
  }

  function openAiContext(apiKey: string | undefined): CustomActionExecutionContext {
    const providersConfig = DEFAULT_CONFIG.providersConfig.map((provider) =>
      provider.id === OPENAI_ID ? { ...provider, apiKey } : provider,
    )
    const provider = resolveProviderRefForCapability("customAction", providersConfig, OPENAI_ID)
    if (provider?.kind !== "local") throw new Error("OpenAI must be a local provider")
    return {
      action: { ...dictionary, providerId: OPENAI_ID },
      provider,
      targetCode: "cmn",
      promptTokens: {
        selection: "frog",
        paragraphs: "frog",
        targetLanguage: "Simplified Chinese",
        webTitle: "",
        webUrl: "https://example.com",
        webContent: "",
      },
    }
  }

  function tier(overrides: Partial<HostedAiTierStatus> = {}): HostedAiTierStatus {
    return {
      accessAllowed: true,
      available: true,
      unavailableReason: null,
      upgradeTo: null,
      requiresUltra: false,
      modelRevision: "r1",
      ...overrides,
    }
  }

  function statusWith(normal: HostedAiTierStatus): HostedAiStatus {
    const entry = { normal, advance: normal }
    return {
      credits: [],
      features: {
        pageTranslation: entry,
        customAction: entry,
        noteSuggestion: entry,
        selectionTranslation: entry,
        videoSubtitles: entry,
        inputTranslation: entry,
        languageDetection: entry,
      },
    }
  }

  function runAction(
    executionContext: CustomActionExecutionContext,
    hostedAiStatus: HostedAiStatus | undefined,
  ) {
    return renderHook(() =>
      useCustomActionExecution({
        analyticsSurface: ANALYTICS_SURFACE.SELECTION_TOOLBAR,
        bodyRef: { current: null },
        executionContext,
        hostedAiStatus,
        open: true,
        popoverSessionKey: 1,
        rerunNonce: 0,
      }),
    )
  }

  function resolvesWith(output: Record<string, unknown>) {
    return async () => ({ output, thinking: { status: "complete", text: "" } })
  }

  beforeEach(() => {
    streamBackgroundStructuredObjectMock.mockReset()
    vi.mocked(trackFeatureUsed).mockClear()
  })

  it("answers on the Built-in AI when it is usable, and says so", async () => {
    streamBackgroundStructuredObjectMock
      .mockRejectedValueOnce(missingApiKeyError())
      .mockImplementationOnce(resolvesWith(answer))

    const { result } = runAction(openAiContext(undefined), statusWith(tier()))

    await waitFor(() => expect(result.current.result).toEqual(answer))
    expect(result.current.isRunning).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.missingApiKey).toEqual({
      kind: "fallback",
      providerId: OPENAI_ID,
      providerName: "OpenAI",
    })

    const [first, second] = streamBackgroundStructuredObjectMock.mock.calls.map(([p]) => p)
    expect(first.providerId).toBe(OPENAI_ID)
    expect(second.providerId).toBe(BUILT_IN_AI_PROVIDER_ID)
    expect(second.modelTier).toBe("normal")
    // Same question, minus the settings only the user's own model understands.
    expect(second.prompt).toBe(first.prompt)
    expect(second.instructions).toBe(first.instructions)
    expect(second.providerOptions).toBeUndefined()

    // Reported as answered by the Built-in AI, standing in for OpenAI.
    expect(trackFeatureUsed).toHaveBeenCalledTimes(1)
    expect(trackFeatureUsed).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "success",
        provider: ANALYTICS_PROVIDER.BUILT_IN_AI,
        backend_kind: "llm",
        fallback_from_provider: "openai",
      }),
    )
  })

  it("treats an unknown hosted status as usable and lets the server decide", async () => {
    streamBackgroundStructuredObjectMock
      .mockRejectedValueOnce(missingApiKeyError())
      .mockImplementationOnce(resolvesWith(answer))

    const { result } = runAction(openAiContext(undefined), undefined)

    await waitFor(() => expect(result.current.result).toEqual(answer))
    expect(result.current.missingApiKey?.kind).toBe("fallback")
  })

  it("offers the key or a log-in when the Built-in AI needs sign-in", async () => {
    streamBackgroundStructuredObjectMock.mockRejectedValueOnce(missingApiKeyError())

    const { result } = runAction(
      openAiContext(undefined),
      statusWith(
        tier({
          accessAllowed: false,
          available: false,
          unavailableReason: "authentication_required",
        }),
      ),
    )

    await waitFor(() => expect(result.current.missingApiKey?.kind).toBe("blocked"))
    expect(result.current.isRunning).toBe(false)
    // The card shows the actionable message, not a generic failure.
    expect(result.current.error).toBeNull()
    expect(result.current.missingApiKey).toEqual({
      kind: "blocked",
      providerId: OPENAI_ID,
      providerName: "OpenAI",
      builtInAiAction: logInAction(),
    })
    expect(streamBackgroundStructuredObjectMock).toHaveBeenCalledTimes(1)
    expect(trackFeatureUsed).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failure",
        failure_reason: "missing_api_key",
        provider: "openai",
      }),
    )
    expect(vi.mocked(trackFeatureUsed).mock.calls[0]![0]).not.toHaveProperty(
      "fallback_from_provider",
    )
  })

  it("offers an upgrade when the Built-in AI is behind a plan", async () => {
    streamBackgroundStructuredObjectMock.mockRejectedValueOnce(missingApiKeyError())

    const { result } = runAction(
      openAiContext(undefined),
      statusWith(
        tier({ accessAllowed: false, available: false, unavailableReason: "pro_required" }),
      ),
    )

    await waitFor(() => expect(result.current.missingApiKey?.kind).toBe("blocked"))
    expect(result.current.missingApiKey).toMatchObject({ builtInAiAction: upgradeAction() })
  })

  it("shows the actionable message when the server turns the fallback away", async () => {
    streamBackgroundStructuredObjectMock
      .mockRejectedValueOnce(missingApiKeyError())
      .mockRejectedValueOnce(
        new StreamPortError({ message: "Log in to use it", reason: "auth_required" }),
      )

    const { result } = runAction(openAiContext(undefined), undefined)

    await waitFor(() => expect(result.current.missingApiKey?.kind).toBe("blocked"))
    expect(result.current.error).toBeNull()
    expect(result.current.missingApiKey).toMatchObject({ builtInAiAction: logInAction() })
    expect(trackFeatureUsed).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failure",
        failure_reason: "auth_required",
        provider: ANALYTICS_PROVIDER.BUILT_IN_AI,
        fallback_from_provider: "openai",
      }),
    )
  })

  it("keeps the Built-in AI's own failure when it is not about access", async () => {
    streamBackgroundStructuredObjectMock
      .mockRejectedValueOnce(missingApiKeyError())
      .mockRejectedValueOnce(
        new StreamPortError({ message: "Quota used up", reason: "quota_exceeded" }),
      )

    const { result } = runAction(openAiContext(undefined), statusWith(tier()))

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.error?.description).toBe("Quota used up")
    expect(result.current.missingApiKey?.kind).toBe("fallback")
  })

  it("leaves a provider with a key alone", async () => {
    streamBackgroundStructuredObjectMock.mockImplementationOnce(resolvesWith(answer))

    const { result } = runAction(openAiContext("sk-test"), statusWith(tier()))

    await waitFor(() => expect(result.current.result).toEqual(answer))
    expect(result.current.missingApiKey).toBeNull()
    expect(streamBackgroundStructuredObjectMock).toHaveBeenCalledTimes(1)
    expect(streamBackgroundStructuredObjectMock.mock.calls[0]![0].providerId).toBe(OPENAI_ID)
    expect(trackFeatureUsed).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "success", provider: "openai" }),
    )
    expect(vi.mocked(trackFeatureUsed).mock.calls[0]![0]).not.toHaveProperty(
      "fallback_from_provider",
    )
  })

  it("does not fall back on other provider failures", async () => {
    streamBackgroundStructuredObjectMock.mockRejectedValueOnce(
      new StreamPortError({ message: "Incorrect API key", reason: "provider_auth" }),
    )

    const { result } = runAction(openAiContext("sk-wrong"), statusWith(tier()))

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.error?.description).toBe("Incorrect API key")
    expect(result.current.missingApiKey).toBeNull()
    expect(streamBackgroundStructuredObjectMock).toHaveBeenCalledTimes(1)
  })
})
