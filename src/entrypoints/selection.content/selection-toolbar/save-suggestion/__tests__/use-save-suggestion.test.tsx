// @vitest-environment jsdom
import type { ReactNode } from "react"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"

const streamBackgroundNoteSuggestionMock = vi.fn<(...args: any[]) => any>()
const validateSaveSuggestionMock = vi.fn<(...args: any[]) => any>()
const isEligibleMock = vi.fn<(...args: any[]) => any>()
const isSuppressedMock = vi.fn<(...args: any[]) => any>()

vi.mock("@/utils/content-script/background-stream-client", () => ({
  streamBackgroundNoteSuggestion: (...args: any[]) => streamBackgroundNoteSuggestionMock(...args),
}))
vi.mock("@/utils/save-suggestion/validate", () => ({
  validateSaveSuggestion: (...args: any[]) => validateSaveSuggestionMock(...args),
}))
vi.mock("@/utils/save-suggestion/cooldown", () => ({
  isSaveSuggestionEligible: (...args: any[]) => isEligibleMock(...args),
}))
vi.mock("../session-guard", () => ({
  isSaveSuggestionSuppressedForPageSession: (...args: any[]) => isSuppressedMock(...args),
  suppressSaveSuggestionForPageSession: vi.fn<() => void>(),
}))

const { useSaveSuggestion } = await import("../use-save-suggestion")

function wrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>
  }
}

const VALID_ENVELOPE = {
  output: {
    action: { createNewDictionaryAction: false, targetActionId: "default-dictionary" },
    notes: [],
  },
  thinking: { status: "complete", text: "" },
}

const fireInput = (sessionKey: string) => ({
  sessionKey,
  selectionText: "ephemeral",
  paragraphsText: "The ephemeral beauty of cherry blossoms.",
  targetLangName: "Simplified Chinese",
  webTitle: "Sakura",
})

describe("useSaveSuggestion session key guard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isEligibleMock.mockResolvedValue(true)
    isSuppressedMock.mockReturnValue(false)
    streamBackgroundNoteSuggestionMock.mockResolvedValue(VALID_ENVELOPE)
    validateSaveSuggestionMock.mockReturnValue({
      target: { kind: "existing", actionId: "default-dictionary" },
      notes: [{ term: "ephemeral" }],
      summaryFieldName: null,
    })
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
      target: { kind: "existing", actionId: "default-dictionary" },
      notes: [{ term: "ephemeral-ja" }],
      summaryFieldName: null,
    })
    act(() => result.current.maybeFire(fireInput("5:langJA:0")))
    await waitFor(() => expect(result.current.suggestion?.sessionKey).toBe("5:langJA:0"))
    expect(streamBackgroundNoteSuggestionMock).toHaveBeenCalledTimes(2)
  })
})
