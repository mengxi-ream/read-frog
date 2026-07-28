// @vitest-environment jsdom
import type { ReactNode } from "react"
import type { SaveSuggestionSessionResult } from "../use-save-suggestion"
import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { storage } from "#imports"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { i18n } from "@/utils/i18n"

const mocks = vi.hoisted(() => ({
  save: vi.fn<(...args: any[]) => any>(),
  toastAdd: vi.fn<(...args: any[]) => any>(),
  track: vi.fn<(...args: any[]) => any>(),
}))

vi.mock(
  "@/entrypoints/selection.content/selection-toolbar/custom-action-button/use-save-to-notebase",
  () => ({
    useSaveToNotebase: () => ({ save: mocks.save, isSaving: false }),
  }),
)

vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: { add: mocks.toastAdd },
}))

vi.mock("@/utils/save-suggestion/analytics", () => ({
  trackSaveSuggestionEvent: (...args: any[]) => mocks.track(...args),
}))

const { SaveSuggestionCard } = await import("../save-suggestion-card")

function wrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>
  }
}

function createAction(
  overrides: Partial<SelectionToolbarCustomAction> = {},
): SelectionToolbarCustomAction {
  return {
    id: "save-action",
    name: "Dictionary",
    enabled: true,
    icon: "tabler:book-2",
    providerId: "read-frog-free-ai",
    systemPrompt: "system",
    prompt: "prompt",
    outputSchema: [
      {
        id: "field-term",
        name: "Term",
        type: "string",
        description: "",
        speaking: true,
      },
      {
        id: "field-definition",
        name: "Definition",
        type: "string",
        description: "",
        speaking: false,
      },
    ],
    ...overrides,
  }
}

function createSuggestion(
  actionSnapshot: SelectionToolbarCustomAction,
): SaveSuggestionSessionResult {
  return {
    sessionKey: "session-1",
    validated: {
      notes: [{ Term: "ephemeral", Definition: "lasting a very short time" }],
      summaryFieldName: "Definition",
    },
    actionSnapshot,
    firedAt: 100,
    analyticsProvider: { provider: "openai", backend_kind: "llm" },
  }
}

function createStoreWithAction(action?: SelectionToolbarCustomAction) {
  const store = createStore()
  const config = structuredClone(DEFAULT_CONFIG)
  config.selectionToolbar.customActions = action ? [action] : []
  config.selectionToolbar.saveSuggestion.actionId = action?.id ?? "default-dictionary"
  store.set(configAtom, config)
  return store
}

function renderCard(
  store: ReturnType<typeof createStore>,
  actionSnapshot: SelectionToolbarCustomAction,
) {
  return render(
    <SaveSuggestionCard
      suggestion={createSuggestion(actionSnapshot)}
      markShownOnce={() => false}
    />,
    { wrapper: wrapper(store) },
  )
}

function clickSave() {
  fireEvent.click(screen.getByRole("button", { name: i18n.t("saveSuggestion.save") }))
}

describe("SaveSuggestionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.save.mockResolvedValue("saved")
  })

  it("saves through the same action after it is disabled", async () => {
    const snapshot = createAction({ enabled: true })
    const liveAction = createAction({ enabled: false })
    const store = createStoreWithAction(liveAction)
    renderCard(store, snapshot)

    clickSave()

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save).toHaveBeenCalledWith({
      action: liveAction,
      results: [{ Term: "ephemeral", Definition: "lasting a very short time" }],
      analyticsSource: "save_suggestion",
      analyticsProvider: { provider: "openai", backend_kind: "llm" },
    })
    expect(mocks.toastAdd).not.toHaveBeenCalled()
  })

  it("marks the suggestion stale when its action was deleted", async () => {
    const snapshot = createAction()
    const store = createStoreWithAction()
    renderCard(store, snapshot)

    clickSave()

    await waitFor(() =>
      expect(mocks.toastAdd).toHaveBeenCalledWith({
        type: "error",
        title: i18n.t("saveSuggestion.staleSuggestion"),
      }),
    )
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it("marks the suggestion stale when the action schema changed", async () => {
    const snapshot = createAction()
    const liveAction = createAction({
      outputSchema: [
        {
          id: "field-word",
          name: "Word",
          type: "string",
          description: "",
          speaking: true,
        },
      ],
    })
    const store = createStoreWithAction(liveAction)
    renderCard(store, snapshot)

    clickSave()

    await waitFor(() => expect(mocks.toastAdd).toHaveBeenCalledTimes(1))
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it("uses the live action when identity, provider, and connection changed but schema did not", async () => {
    const snapshot = createAction()
    const liveAction = createAction({
      name: "Live Dictionary",
      providerId: "new-provider",
      notebaseConnection: {
        notebaseId: "notebase-live",
        notebaseNameSnapshot: "Live Notes",
        connectedAccount: {
          id: "account-live",
          name: "Reader",
          email: "reader@example.com",
          image: null,
        },
        mappings: [
          {
            id: "mapping-live",
            localFieldId: "field-term",
            notebaseColumnId: "column-live",
            notebaseColumnNameSnapshot: "Term",
          },
        ],
      },
    })
    const store = createStoreWithAction(liveAction)
    renderCard(store, snapshot)

    clickSave()

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save.mock.calls[0]?.[0]?.action).toEqual(liveAction)
    expect(mocks.toastAdd).not.toHaveBeenCalled()
  })

  it("preserves the selected action when toggling Save Suggestion", async () => {
    const action = createAction()
    const store = createStoreWithAction(action)
    await storage.setItem("local:config", store.get(configAtom))
    renderCard(store, action)

    fireEvent.click(screen.getByRole("switch"))

    await waitFor(() => {
      expect(store.get(configAtom).selectionToolbar.saveSuggestion).toEqual({
        enabled: false,
        actionId: action.id,
      })
    })
    await waitFor(async () => {
      expect(
        (await storage.getItem<Config>("local:config"))?.selectionToolbar.saveSuggestion,
      ).toEqual({
        enabled: false,
        actionId: action.id,
      })
    })
    await storage.removeItem("local:config")
  })
})
