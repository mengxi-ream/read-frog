// @vitest-environment jsdom
import type { ReactNode } from "react"
import type { NoteSuggestionFireInput } from "../use-note-suggestion"
import type { LLMProviderConfig } from "@/types/config/provider"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const streamBackgroundNoteSuggestionMock = vi.fn<(...args: any[]) => any>()
const validateNoteSuggestionMock = vi.fn<(...args: any[]) => any>()
const getOrCreateWebPageContextMock = vi.fn<(...args: any[]) => any>()
const hostedStatusMock = vi.fn<(...args: any[]) => any>()

vi.mock("@/utils/content-script/background-stream-client", () => ({
  streamBackgroundNoteSuggestion: (...args: any[]) => streamBackgroundNoteSuggestionMock(...args),
}))
vi.mock("@/utils/note-suggestion/validate", () => ({
  validateNoteSuggestion: (...args: any[]) => validateNoteSuggestionMock(...args),
}))
vi.mock("@/utils/host/translate/webpage-context", () => ({
  getOrCreateWebPageContext: (...args: any[]) => getOrCreateWebPageContextMock(...args),
}))
vi.mock("@/utils/orpc/client", () => ({
  orpcClient: {
    hostedAi: {
      status: (...args: any[]) => hostedStatusMock(...args),
    },
  },
}))

const { useNoteSuggestion } = await import("../use-note-suggestion")

function wrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>
  }
}

const LLM_PROVIDER_CONFIG = DEFAULT_CONFIG.providersConfig.find(
  (providerConfig): providerConfig is LLMProviderConfig =>
    isLLMProviderConfig(providerConfig) && providerConfig.provider === "openai",
)!

const LOCAL_PROVIDER_REF = {
  kind: "local",
  id: LLM_PROVIDER_CONFIG.id,
  name: LLM_PROVIDER_CONFIG.name,
  config: LLM_PROVIDER_CONFIG,
} satisfies NoteSuggestionFireInput["provider"]

const SYSTEM_PROVIDER_REF = {
  kind: "system",
  id: "read-frog-free-ai",
  name: "Built-in AI",
  modelTier: "normal",
} satisfies NoteSuggestionFireInput["provider"]

const VALID_ENVELOPE = {
  output: {
    summaryFieldName: null,
    notes: [{ fields: [{ name: "Word", value: "ephemeral" }] }],
  },
  thinking: { status: "complete", text: "" },
}

const EMPTY_NOTES_ENVELOPE = {
  output: {
    summaryFieldName: null,
    notes: [],
  },
  thinking: { status: "complete", text: "" },
}

const VALIDATED_SUGGESTION = {
  notes: [{ term: "ephemeral" }],
  summaryFieldName: null,
}

function createHostedStatus(available: boolean) {
  return {
    features: {
      noteSuggestion: {
        normal: available
          ? { available: true }
          : { available: false, unavailableReason: "quota_exhausted" },
      },
    },
    credits: [],
  }
}

const fireInput = (
  sessionKey: string,
  provider: NoteSuggestionFireInput["provider"] = LOCAL_PROVIDER_REF,
): NoteSuggestionFireInput => ({
  sessionKey,
  selectionText: "ephemeral",
  paragraphsText: "The ephemeral beauty of cherry blossoms.",
  targetLangName: "Simplified Chinese",
  webTitle: "Sakura",
  provider,
})

/** Flushes the hook's async run chain (status gate, stream). */
async function flushRun() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe("useNoteSuggestion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getOrCreateWebPageContextMock.mockResolvedValue({
      url: "https://example.com/article",
      webTitle: "Article",
      webDescription: "",
      webContent: "Cached article body",
    })
    streamBackgroundNoteSuggestionMock.mockResolvedValue(VALID_ENVELOPE)
    validateNoteSuggestionMock.mockReturnValue(VALIDATED_SUGGESTION)
    hostedStatusMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it("re-fires and replaces the suggestion when the composite key changes, but not for the same key", async () => {
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useNoteSuggestion(), { wrapper: wrapper(store) })

    // First fire for key A → one request, suggestion tagged with A.
    act(() => result.current.maybeFire(fireInput("5:langZH:0")))
    await waitFor(() => expect(result.current.suggestion?.sessionKey).toBe("5:langZH:0"))
    expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(1)

    // Same key again (e.g. an extra effect run) → guard blocks, no new request.
    act(() => result.current.maybeFire(fireInput("5:langZH:0")))
    await Promise.resolve()
    expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(1)

    // Different key (target language changed) → new request, suggestion replaced.
    validateNoteSuggestionMock.mockReturnValueOnce({
      ...VALIDATED_SUGGESTION,
      notes: [{ term: "ephemeral-ja" }],
    })
    act(() => result.current.maybeFire(fireInput("5:langJA:0")))
    await waitFor(() => expect(result.current.suggestion?.sessionKey).toBe("5:langJA:0"))
    expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(2)
  })

  it("uses the user's provider for the request and classifies it in the result", async () => {
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useNoteSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: LLM_PROVIDER_CONFIG.id }),
      expect.anything(),
    )
    // A local provider never consults the hosted availability gate.
    expect(hostedStatusMock).not.toHaveBeenCalled()
    expect(result.current.suggestion?.analyticsProvider).toEqual({
      provider: "openai",
      backend_kind: "llm",
    })
  })

  it("sends the hosted payload for a system provider without local provider knobs", async () => {
    hostedStatusMock.mockResolvedValue(createHostedStatus(true))
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useNoteSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0", SYSTEM_PROVIDER_REF)))
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    expect(hostedStatusMock).toHaveBeenCalledTimes(1)

    const request = streamBackgroundNoteSuggestionMock.mock.calls[0]![0]
    // Exact shape: no providerOptions, reasoning, or temperature leak into the
    // hosted payload — the server owns those knobs.
    expect(request).toEqual({
      providerId: SYSTEM_PROVIDER_REF.id,
      modelTier: SYSTEM_PROVIDER_REF.modelTier,
      requestId: expect.any(String),
      instructions: expect.any(String),
      prompt: expect.any(String),
    })
    // Hosted envelope contract: the prompts describe the contract's
    // action+notes shape (with the pinned inert action fields).
    expect(request.instructions).toContain('"action"')
    expect(request.instructions).toContain("createNewDictionaryAction")
    expect(request.instructions).toContain("targetActionId")
  })

  it("classifies a system provider suggestion as Built-in AI", async () => {
    hostedStatusMock.mockResolvedValue(createHostedStatus(true))
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useNoteSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0", SYSTEM_PROVIDER_REF)))
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    expect(result.current.suggestion?.analyticsProvider).toEqual({
      provider: "read-frog-built-in-ai",
      backend_kind: "llm",
    })
  })

  it("skips silently and completes the session when the hosted tier is unavailable", async () => {
    hostedStatusMock.mockResolvedValue(createHostedStatus(false))
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useNoteSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0", SYSTEM_PROVIDER_REF)))
    await waitFor(() => expect(hostedStatusMock).toHaveBeenCalledTimes(1))
    await flushRun()

    expect(streamBackgroundNoteSuggestionMock).not.toHaveBeenCalled()
    expect(result.current.suggestion).toBeNull()

    // The session is marked complete: the same key neither re-checks the
    // status nor fires a request.
    act(() => result.current.maybeFire(fireInput("1:lang:0", SYSTEM_PROVIDER_REF)))
    await flushRun()
    expect(hostedStatusMock).toHaveBeenCalledTimes(1)
    expect(streamBackgroundNoteSuggestionMock).not.toHaveBeenCalled()
  })

  it("fails open and fires when the hosted status check itself fails", async () => {
    hostedStatusMock.mockRejectedValue(new Error("status endpoint down"))
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useNoteSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0", SYSTEM_PROVIDER_REF)))
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(1)
  })

  it("uses the configured action snapshot even when the action is disabled", async () => {
    const store = createStore()
    const config = structuredClone(DEFAULT_CONFIG)
    config.selectionToolbar.builtInActions.dictionary.enabled = false
    config.selectionToolbar.customActions = []
    store.set(configAtom, config)
    const { result } = renderHook(() => useNoteSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(1)
    expect(result.current.suggestion?.actionSnapshot).toMatchObject({
      id: "default-dictionary",
      enabled: false,
    })
  })

  it("uses only the action configured for Note suggestion", async () => {
    const store = createStore()
    const config = structuredClone(DEFAULT_CONFIG)
    const customAction: SelectionToolbarCustomAction = {
      id: "custom-dictionary",
      name: "Custom Dictionary",
      enabled: true,
      icon: "tabler:book-2",
      providerId: LLM_PROVIDER_CONFIG.id,
      systemPrompt: "system",
      prompt: "prompt",
      outputSchema: [
        {
          id: "custom-term",
          name: "Word",
          type: "string",
          description: "The vocabulary term",
          speaking: true,
        },
      ],
    }
    config.selectionToolbar.builtInActions.dictionary.enabled = false
    config.selectionToolbar.customActions = [customAction]
    config.selectionToolbar.noteSuggestion.actionId = customAction.id
    store.set(configAtom, config)
    const { result } = renderHook(() => useNoteSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("disabled-built-in:lang:0")))
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    const request = streamBackgroundNoteSuggestionMock.mock.calls[0]![0]
    expect(request.instructions).toContain("## Selected Action System Prompt\nsystem")
    expect(request.instructions).not.toContain("createNewDictionaryAction")
    expect(request.instructions).not.toContain("targetActionId")
    expect(request.prompt).toContain("## Selected Action User Prompt\nprompt")
    expect(request.prompt).toContain('- key: "Word"')
    expect(request.prompt).toContain("Cached article body")
    expect(validateNoteSuggestionMock).toHaveBeenCalledWith({
      envelope: expect.any(Object),
      action: customAction,
    })
    expect(result.current.suggestion?.actionSnapshot.id).toBe(customAction.id)
  })

  it("stays silent and completes the session when the request rejects", async () => {
    streamBackgroundNoteSuggestionMock.mockRejectedValue(new Error("provider exploded"))
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useNoteSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(1))
    await flushRun()
    expect(result.current.suggestion).toBeNull()

    // Failure completes the session: the same key does not retry, but a new
    // key (next popover session) fires again — no persistent backoff.
    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await flushRun()
    expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(1)
    act(() => result.current.maybeFire(fireInput("2:lang:0")))
    await waitFor(() => expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(2))
  })

  it("discards a schema/semantically invalid envelope without a card", async () => {
    validateNoteSuggestionMock.mockReturnValue(null)
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useNoteSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(validateNoteSuggestionMock).toHaveBeenCalledTimes(1))
    await flushRun()
    expect(result.current.suggestion).toBeNull()
  })

  it("treats a valid empty-notes response as a success without a card", async () => {
    streamBackgroundNoteSuggestionMock.mockResolvedValue(EMPTY_NOTES_ENVELOPE)
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useNoteSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(1))
    await flushRun()
    expect(validateNoteSuggestionMock).not.toHaveBeenCalled()
    expect(result.current.suggestion).toBeNull()

    // The session is completed: no re-fire for the same key.
    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await Promise.resolve()
    expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(1)
  })

  it("treats a dropped stream port as neutral and allows a later retry", async () => {
    streamBackgroundNoteSuggestionMock.mockRejectedValueOnce(
      new Error("Stream disconnected unexpectedly"),
    )
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useNoteSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(1))
    await act(async () => {
      await Promise.resolve()
    })

    // The session was not marked completed, so the same key may retry.
    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(result.current.suggestion?.sessionKey).toBe("1:lang:0"))
    expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(2)
  })

  it("renders no card and keeps the session retryable when the request aborts", async () => {
    streamBackgroundNoteSuggestionMock.mockRejectedValue(
      new DOMException("stream aborted", "AbortError"),
    )
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useNoteSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(1))
    // Give the rejection handler a chance to run before asserting.
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.suggestion).toBeNull()
  })
})
