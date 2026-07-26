// @vitest-environment jsdom
import type { SaveSuggestionSessionResult } from "../use-save-suggestion"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { writeSpy, saveMock, trackSaveSuggestionEventMock } = vi.hoisted(() => ({
  writeSpy: vi.fn<(...args: any[]) => any>(),
  saveMock: vi.fn<(...args: any[]) => any>(),
  trackSaveSuggestionEventMock: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/i18n", () => ({
  i18n: { t: (key: string) => key },
  initI18n: async () => {},
  setUiLanguage: async () => {},
}))

vi.mock("@/utils/atoms/config", async () => {
  const { atom } = await import("jotai")
  const selectionToolbarAtom = atom(
    () => ({ saveSuggestion: { enabled: true }, customActions: [] }),
    (_get, _set, patch: unknown) => {
      writeSpy(patch)
    },
  )
  return { configFieldsAtomMap: { selectionToolbar: selectionToolbarAtom } }
})

vi.mock("../../custom-action-button/use-save-to-notebase", () => ({
  useSaveToNotebase: () => ({ save: saveMock, isSaving: false }),
}))

vi.mock("@/utils/save-suggestion/analytics", () => ({
  trackSaveSuggestionEvent: (...args: any[]) => trackSaveSuggestionEventMock(...args),
}))

const { SaveSuggestionCard } = await import("../save-suggestion-card")

const ANALYTICS_PROVIDER = { provider: "openai", backend_kind: "llm" } as const

function createSuggestion(): SaveSuggestionSessionResult {
  return {
    sessionKey: "1:lang:0",
    validated: {
      target: { kind: "existing", actionId: "action-1" },
      notes: [{ Word: "ephemeral" }],
      summaryFieldName: null,
    },
    actionSnapshot: {
      id: "action-1",
      name: "Dictionary",
      icon: "tabler:book",
      providerId: "openai-default",
      systemPrompt: "system",
      prompt: "prompt",
      outputSchema: [
        { id: "word", name: "Word", type: "string", description: "", speaking: false },
      ],
    },
    dictionaryDraft: null,
    firedAt: 123,
    analyticsProvider: ANALYTICS_PROVIDER,
  }
}

describe("saveSuggestionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ""
  })

  it("turns the feature off through the in-card switch", () => {
    render(<SaveSuggestionCard suggestion={createSuggestion()} markShownOnce={() => false} />)

    const toggle = screen.getByRole("switch", { name: "saveSuggestion.toggleLabel" })
    expect(toggle).toHaveAttribute("data-checked")

    fireEvent.click(toggle)

    expect(writeSpy).toHaveBeenCalledWith({ saveSuggestion: { enabled: false } })
  })

  it("tracks the shown event with the suggestion's provider classification", () => {
    render(<SaveSuggestionCard suggestion={createSuggestion()} markShownOnce={() => true} />)

    expect(trackSaveSuggestionEventMock).toHaveBeenCalledWith("suggestion_shown", {
      startedAt: 123,
      provider: ANALYTICS_PROVIDER,
    })
  })
})
