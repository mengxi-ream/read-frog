// @vitest-environment jsdom
import type { ReactNode } from "react"
import type { LLMProviderConfig } from "@/types/config/provider"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const streamBackgroundNoteSuggestionMock = vi.fn<(...args: any[]) => any>()
const validateSaveSuggestionMock = vi.fn<(...args: any[]) => any>()
const isAttemptAllowedMock = vi.fn<(...args: any[]) => any>()
const recordFailureMock = vi.fn<(...args: any[]) => any>()
const recordSuccessMock = vi.fn<(...args: any[]) => any>()

vi.mock("@/utils/content-script/background-stream-client", () => ({
  streamBackgroundNoteSuggestion: (...args: any[]) => streamBackgroundNoteSuggestionMock(...args),
}))
vi.mock("@/utils/save-suggestion/validate", () => ({
  validateSaveSuggestion: (...args: any[]) => validateSaveSuggestionMock(...args),
}))
vi.mock("@/utils/save-suggestion/provider-cooldown", () => ({
  getSaveSuggestionProviderFingerprint: (config: unknown) => JSON.stringify(config),
  isSaveSuggestionAttemptAllowed: (...args: any[]) => isAttemptAllowedMock(...args),
  recordSaveSuggestionFailure: (...args: any[]) => recordFailureMock(...args),
  recordSaveSuggestionSuccess: (...args: any[]) => recordSuccessMock(...args),
}))

const { useSaveSuggestion } = await import("../use-save-suggestion")

function wrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>
  }
}

const LLM_PROVIDER_CONFIG = DEFAULT_CONFIG.providersConfig.find(
  (providerConfig): providerConfig is LLMProviderConfig =>
    isLLMProviderConfig(providerConfig) && providerConfig.provider === "openai",
)!

const VALID_ENVELOPE = {
  output: {
    action: { createNewDictionaryAction: false, targetActionId: "default-dictionary" },
    notes: [{ fields: [{ name: "Word", value: "ephemeral" }] }],
  },
  thinking: { status: "complete", text: "" },
}

const EMPTY_NOTES_ENVELOPE = {
  output: {
    action: { createNewDictionaryAction: false, targetActionId: null },
    notes: [],
  },
  thinking: { status: "complete", text: "" },
}

const VALIDATED_SUGGESTION = {
  target: { kind: "existing", actionId: "default-dictionary" },
  notes: [{ term: "ephemeral" }],
  summaryFieldName: null,
}

const fireInput = (sessionKey: string) => ({
  sessionKey,
  selectionText: "ephemeral",
  paragraphsText: "The ephemeral beauty of cherry blossoms.",
  targetLangName: "Simplified Chinese",
  webTitle: "Sakura",
  providerId: LLM_PROVIDER_CONFIG.id,
  providerConfig: LLM_PROVIDER_CONFIG,
})

describe("useSaveSuggestion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isAttemptAllowedMock.mockResolvedValue(true)
    recordFailureMock.mockResolvedValue(undefined)
    recordSuccessMock.mockResolvedValue(undefined)
    streamBackgroundNoteSuggestionMock.mockResolvedValue(VALID_ENVELOPE)
    validateSaveSuggestionMock.mockReturnValue(VALIDATED_SUGGESTION)
  })

  afterEach(() => {
    cleanup()
  })

  it("re-fires and replaces the suggestion when the composite key changes, but not for the same key", async () => {
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useSaveSuggestion(), { wrapper: wrapper(store) })

    // First fire for key A → one request, suggestion tagged with A.
    act(() => result.current.maybeFire(fireInput("5:langZH:0")))
    await waitFor(() => expect(result.current.suggestion?.sessionKey).toBe("5:langZH:0"))
    expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(1)

    // Same key again (e.g. an extra effect run) → guard blocks, no new request.
    act(() => result.current.maybeFire(fireInput("5:langZH:0")))
    await Promise.resolve()
    expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(1)

    // Different key (target language changed) → new request, suggestion replaced.
    validateSaveSuggestionMock.mockReturnValueOnce({
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
    const { result } = renderHook(() => useSaveSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: LLM_PROVIDER_CONFIG.id }),
      expect.anything(),
    )
    expect(result.current.suggestion?.analyticsProvider).toEqual({
      provider: "openai",
      backend_kind: "llm",
    })
    expect(recordSuccessMock).toHaveBeenCalledTimes(1)
    expect(recordFailureMock).not.toHaveBeenCalled()
  })

  it("does not fire while the provider cooldown blocks the attempt", async () => {
    isAttemptAllowedMock.mockResolvedValue(false)
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useSaveSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(isAttemptAllowedMock).toHaveBeenCalledTimes(1))
    expect(isAttemptAllowedMock).toHaveBeenCalledWith(
      {
        providerId: LLM_PROVIDER_CONFIG.id,
        providerFingerprint: JSON.stringify(LLM_PROVIDER_CONFIG),
      },
      expect.any(Number),
    )
    expect(streamBackgroundNoteSuggestionMock).not.toHaveBeenCalled()
    expect(result.current.suggestion).toBeNull()
  })

  it("records a failure when the request rejects", async () => {
    streamBackgroundNoteSuggestionMock.mockRejectedValue(new Error("provider exploded"))
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useSaveSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(recordFailureMock).toHaveBeenCalledTimes(1))
    expect(recordFailureMock).toHaveBeenCalledWith({
      providerId: LLM_PROVIDER_CONFIG.id,
      providerFingerprint: JSON.stringify(LLM_PROVIDER_CONFIG),
    })
    expect(recordSuccessMock).not.toHaveBeenCalled()
    expect(result.current.suggestion).toBeNull()
  })

  it("records a failure when the envelope is invalid", async () => {
    validateSaveSuggestionMock.mockReturnValue(null)
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useSaveSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(recordFailureMock).toHaveBeenCalledTimes(1))
    expect(recordSuccessMock).not.toHaveBeenCalled()
    expect(result.current.suggestion).toBeNull()
  })

  it("treats a valid empty-notes response as a success without a card", async () => {
    streamBackgroundNoteSuggestionMock.mockResolvedValue(EMPTY_NOTES_ENVELOPE)
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useSaveSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(recordSuccessMock).toHaveBeenCalledTimes(1))
    expect(recordFailureMock).not.toHaveBeenCalled()
    expect(validateSaveSuggestionMock).not.toHaveBeenCalled()
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
    const { result } = renderHook(() => useSaveSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(1))
    await act(async () => {
      await Promise.resolve()
    })
    expect(recordFailureMock).not.toHaveBeenCalled()
    expect(recordSuccessMock).not.toHaveBeenCalled()

    // The session was not marked completed, so the same key may retry.
    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(result.current.suggestion?.sessionKey).toBe("1:lang:0"))
    expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(2)
  })

  it("records neither success nor failure when the request aborts", async () => {
    streamBackgroundNoteSuggestionMock.mockRejectedValue(
      new DOMException("stream aborted", "AbortError"),
    )
    const store = createStore()
    store.set(configAtom, DEFAULT_CONFIG)
    const { result } = renderHook(() => useSaveSuggestion(), { wrapper: wrapper(store) })

    act(() => result.current.maybeFire(fireInput("1:lang:0")))
    await waitFor(() => expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(1))
    // Give the rejection handler a chance to run before asserting.
    await act(async () => {
      await Promise.resolve()
    })
    expect(recordFailureMock).not.toHaveBeenCalled()
    expect(recordSuccessMock).not.toHaveBeenCalled()
    expect(result.current.suggestion).toBeNull()
  })
})
