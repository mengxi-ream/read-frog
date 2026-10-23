// @vitest-environment jsdom
import type { NotebaseGetSchemaOutput } from "@read-frog/api-contract"
import type { Config } from "@/types/config/config"
import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionNotebaseConnection,
} from "@/types/config/selection-toolbar"
import { ORPCError } from "@orpc/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { env } from "@/env"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getBuiltInDictionaryAction } from "@/utils/custom-actions"
import { formatUiList, i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { buildCustomActionOptionsRoute } from "@/utils/navigation"
import { mapNotebaseField } from "@/utils/notebase/mapping"
import { orpcClient } from "@/utils/orpc/client"
import { SaveToNotebaseButton } from "../save-to-notebase-button"
import { SaveToNotebaseDialogHost } from "../save-to-notebase-dialog-host"

const mockAuthState = vi.hoisted(() => ({
  session: {
    user: {
      id: "user-1",
      name: "Reader",
      email: "reader@example.com",
      image: null,
    },
  },
  isPending: false,
}))

const toastManagerMock = vi.hoisted(() => ({
  add: vi.fn<(...args: any[]) => any>(),
  close: vi.fn<(...args: any[]) => any>(),
}))

const notebaseRowCreateMock = vi.hoisted(() => vi.fn<(...args: any[]) => any>())
const notebaseRowCreateManyMock = vi.hoisted(() => vi.fn<(...args: any[]) => any>())
const guideTrackingMocks = vi.hoisted(() => ({
  canUseGuideDictionaryNotebaseTracking: vi.fn<(...args: any[]) => any>(),
  getActiveGuideDictionaryNotebaseTrackingForAction: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: mockAuthState.session,
      isPending: mockAuthState.isPending,
    }),
  },
}))

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn<(...args: any[]) => any>(),
}))

vi.mock("@/utils/guide/dictionary-notebase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/guide/dictionary-notebase")>()

  return {
    ...actual,
    canUseGuideDictionaryNotebaseTracking: guideTrackingMocks.canUseGuideDictionaryNotebaseTracking,
    getActiveGuideDictionaryNotebaseTrackingForAction:
      guideTrackingMocks.getActiveGuideDictionaryNotebaseTrackingForAction,
  }
})

vi.mock("@/components/ui/base-ui/toast", () => ({
  toastManager: toastManagerMock,
}))

vi.mock("@/utils/orpc/client", () => ({
  orpc: {
    notebase: {
      getSchema: {
        queryOptions: (options: unknown) => ({
          queryKey: ["notebase", "schema"],
          queryFn: vi.fn<(...args: any[]) => any>(),
          ...(options as object),
        }),
      },
    },
    srs: {
      recentNotebaseScheduleStatusStats: {
        key: () => ["srs", "recentNotebaseScheduleStatusStats"],
      },
    },
  },
  orpcClient: {
    notebase: {
      create: vi.fn<(...args: any[]) => any>(),
      getSchema: vi.fn<(...args: any[]) => any>(),
      list: vi.fn<(...args: any[]) => any>(),
    },
    notebaseRow: {
      create: notebaseRowCreateMock,
      createMany: notebaseRowCreateManyMock,
    },
  },
}))

function cloneConfig(config: Config): Config {
  return JSON.parse(JSON.stringify(config)) as Config
}

function createAction(): SelectionToolbarCustomAction {
  return {
    id: "action-1",
    name: "Summarize",
    icon: "tabler:sparkles",
    providerId: "provider-1",
    systemPrompt: "system",
    prompt: "prompt",
    outputSchema: [
      {
        id: "field-summary",
        name: "summary",
        type: "string",
        description: "",
      },
    ],
  }
}

function createConnectedAction(): SelectionToolbarCustomAction {
  return {
    ...createAction(),
    notebaseConnection: {
      notebaseId: "notebase-1",
      notebaseNameSnapshot: "Summarize Notes",
      connectedAccount: {
        id: "user-1",
        name: "Reader",
        email: "reader@example.com",
        image: null,
      },
      mappings: [
        {
          id: "mapping-1",
          localFieldId: "field-summary",
          notebaseColumnId: "column-summary",
          notebaseColumnNameSnapshot: "Summary",
        },
      ],
    },
  }
}

function createDictionaryAction(): SelectionToolbarCustomAction {
  return getBuiltInDictionaryAction(cloneConfig(DEFAULT_CONFIG).selectionToolbar)
}

function createConnectedDictionaryAction(): SelectionToolbarCustomAction {
  const action = createDictionaryAction()

  return {
    ...action,
    notebaseConnection: {
      notebaseId: "notebase-1",
      notebaseNameSnapshot: "Dictionary Notes",
      connectedAccount: {
        id: "user-1",
        name: "Reader",
        email: "reader@example.com",
        image: null,
      },
      mappings: action.outputSchema.map((field) => ({
        id: `mapping-${field.id}`,
        localFieldId: field.id,
        notebaseColumnId: `column-${field.id}`,
        notebaseColumnNameSnapshot: field.name,
      })),
    },
  }
}

function createSchema(columnId = "column-summary"): NotebaseGetSchemaOutput {
  return {
    id: "notebase-1",
    name: "Summarize Notes",
    updatedAt: new Date(),
    notebaseColumns: [
      {
        id: columnId,
        notebaseId: "notebase-1",
        name: "Summary",
        config: { type: "string" },
        position: 0,
        isPrimary: true,
        wrap: false,
        width: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  }
}

function createSchemaForAction(action: SelectionToolbarCustomAction): NotebaseGetSchemaOutput {
  return {
    id: "notebase-1",
    name: "Dictionary Notes",
    updatedAt: new Date(),
    notebaseColumns: action.outputSchema.map((field, index) => ({
      id: `column-${field.id}`,
      notebaseId: "notebase-1",
      name: field.name,
      config:
        field.type === "number"
          ? { type: "number", decimal: 0, format: "number" }
          : { type: "string" },
      position: index,
      isPrimary: index === 0,
      wrap: false,
      width: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  }
}

function getNoteSaveCompletions() {
  return vi
    .mocked(sendMessage)
    .mock.calls.filter(
      ([type, data]) =>
        type === "trackFeatureUsedEvent" &&
        (data as { action_id?: string }).action_id === "save_completed",
    )
    .map(([, data]) => data)
}

function renderButton(
  config: Config,
  action: SelectionToolbarCustomAction,
  { failed = false }: { failed?: boolean } = {},
) {
  const store = createStore()
  store.set(configAtom, config)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  })
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <SaveToNotebaseButton
          action={action}
          failed={failed}
          isRunning={false}
          result={{ summary: "A short summary" }}
        />
        <SaveToNotebaseDialogHost />
      </Provider>
    </QueryClientProvider>,
  )
  return { ...rendered, store }
}

function getStoredDictionaryConnection(store: ReturnType<typeof createStore>) {
  return store.get(configAtom).selectionToolbar.builtInActions.dictionary.notebaseConnection
}

describe("saveToNotebaseButton notebase availability", () => {
  beforeEach(async () => {
    // Config writes merge into what storage holds, so one test's connection
    // must not seed the next.
    await fakeBrowser.storage.local.clear()
    vi.clearAllMocks()
    toastManagerMock.add.mockReset().mockReturnValue("toast-id")
    toastManagerMock.close.mockReset()
    notebaseRowCreateMock.mockReset()
    mockAuthState.session = {
      user: {
        id: "user-1",
        name: "Reader",
        email: "reader@example.com",
        image: null,
      },
    }
    mockAuthState.isPending = false
    const createResult = {
      txid: 1,
      notebase: {
        id: "notebase-1",
        userId: "user-1",
        name: "Summarize Notes",
        srsNewPerDay: -1,
        srsReviewsPerDay: -1,
        srsDesiredRetention: 0.9,
        srsEnableShortTerm: true,
        srsMaximumInterval: 36500,
        srsLearningSteps: ["1m" as const],
        srsRelearningSteps: ["10m" as const],
        srsLeechThreshold: 8,
        srsEnableFuzz: false,
        srsModelVersion: "FSRS-6" as const,
        srsWeights: null,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    }
    vi.mocked(orpcClient.notebase.create).mockResolvedValue(createResult)
    vi.mocked(orpcClient.notebase.list).mockResolvedValue([
      { id: "notebase-1", name: "Summarize Notes" },
    ])
    vi.mocked(orpcClient.notebase.getSchema).mockResolvedValue(createSchema())
    notebaseRowCreateMock.mockResolvedValue({ txid: 1 })
    vi.mocked(sendMessage).mockResolvedValue(undefined)
    guideTrackingMocks.canUseGuideDictionaryNotebaseTracking.mockReturnValue(false)
    guideTrackingMocks.getActiveGuideDictionaryNotebaseTrackingForAction.mockResolvedValue(null)
  })

  it("renders when beta experience is disabled", () => {
    const config = cloneConfig(DEFAULT_CONFIG)

    config.betaExperience.enabled = false
    renderButton(config, createAction())

    expect(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") })).toBeEnabled()
  })

  it("opens a create/connect dialog for an unconnected custom action", () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    renderButton(config, createAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

    expect(screen.getByText(i18n.t("action.saveToNotebaseCreateTitle"))).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("action.saveToNotebaseCreateAndSaveShort") }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("action.saveToNotebaseConnectExisting") }),
    ).toBeInTheDocument()
  })

  it("opens the created notebase after creating and saving", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    renderButton(config, createAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("action.saveToNotebaseCreateAndSaveShort") }),
    )

    await waitFor(() => {
      expect(orpcClient.notebase.create).toHaveBeenCalledTimes(1)
    })

    const createInput = vi.mocked(orpcClient.notebase.create).mock.calls[0]?.[0] as
      | { id: string }
      | undefined
    expect(createInput?.id).toBeTruthy()

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith("openPage", {
        url: expect.stringContaining(`/notebase/${encodeURIComponent(createInput!.id)}`),
        active: true,
      })
    })
  })

  it("shows an upgrade action when creating a Notebase exceeds the note limit", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    vi.mocked(orpcClient.notebase.create).mockRejectedValueOnce(
      new ORPCError("NOTE_LIMIT_EXCEEDED", { status: 403 }),
    )
    renderButton(config, createAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("action.saveToNotebaseCreateAndSaveShort") }),
    )

    await waitFor(() => {
      expect(toastManagerMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: i18n.t("action.saveToNotebaseLimitExceeded"),
          actionProps: expect.objectContaining({
            children: i18n.t("action.upgrade"),
            onClick: expect.any(Function),
          }),
        }),
      )
    })

    const toastOptions = toastManagerMock.add.mock.calls[0]?.[0] as
      | { actionProps?: { onClick?: () => void } }
      | undefined
    toastOptions?.actionProps?.onClick?.()

    expect(toastManagerMock.close).toHaveBeenCalledWith("toast-id")
    expect(sendMessage).toHaveBeenCalledWith("openPage", {
      url: new URL("/pricing", env.WXT_WEBSITE_URL).toString(),
      active: true,
    })
  })

  it("marks guide Dictionary Notebase complete after direct create-and-save with guide tracking", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    guideTrackingMocks.canUseGuideDictionaryNotebaseTracking.mockReturnValue(true)
    guideTrackingMocks.getActiveGuideDictionaryNotebaseTrackingForAction.mockResolvedValue({
      id: "tracking-1",
      actionId: "default-dictionary",
      sourceUrl: "https://readfrog.app/guide/step-4",
      startedAt: 1_000,
      expiresAt: 1_801_000,
    })
    const action = createDictionaryAction()
    renderButton(config, action)

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))
    await waitFor(() => {
      expect(screen.getByText(i18n.t("action.saveToNotebaseCreateTitle"))).toBeInTheDocument()
    })
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("action.saveToNotebaseCreateAndSaveShort") }),
    )

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith("completeGuideDictionaryNotebase", {
        trackingId: "tracking-1",
        actionId: "default-dictionary",
        notebaseId: expect.any(String),
        sourceUrl: "https://readfrog.app/guide/step-4",
      })
    })
  })

  it("redirects logged-out users to home while the background save opens the notebase later", async () => {
    mockAuthState.session = null as unknown as typeof mockAuthState.session
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    renderButton(config, createAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("action.saveToNotebaseLoginAndCreate") }),
    )

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        "openPage",
        expect.objectContaining({
          active: true,
        }),
      )
    })

    const openPageCall = vi
      .mocked(sendMessage)
      .mock.calls.find(([message]) => message === "openPage")
    expect(openPageCall).toBeDefined()
    const [, openPagePayload] = openPageCall as ["openPage", { url: string }]
    const loginUrl = new URL(openPagePayload.url)

    expect(loginUrl.pathname).toBe("/log-in")
    expect(loginUrl.searchParams.get("redirectTo")).toBe("/home")
    expect(loginUrl.searchParams.has("rfPending")).toBe(false)
  })

  it("keeps the connected save button enabled while logged out and opens the login-connected dialog", () => {
    mockAuthState.session = null as unknown as typeof mockAuthState.session
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    renderButton(config, createConnectedAction())

    const saveButton = screen.getByRole("button", { name: i18n.t("action.saveToNotebase") })
    expect(saveButton).toBeEnabled()

    fireEvent.click(saveButton)

    expect(screen.getByText(i18n.t("action.saveToNotebaseLoginConnectedTitle"))).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("action.saveToNotebaseLoginAndSave") }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("action.saveToNotebaseGoConfigure") }),
    ).toBeInTheDocument()
  })

  it("opens the create/connect dialog when the connected account differs from the logged-in account", async () => {
    mockAuthState.session = {
      user: {
        id: "user-2",
        name: "Other Reader",
        email: "other@example.com",
        image: null,
      },
    }
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    vi.mocked(orpcClient.notebase.list).mockResolvedValueOnce([])
    renderButton(config, createConnectedAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

    await waitFor(() => {
      expect(
        screen.getByText(i18n.t("action.saveToNotebaseConnectionUnavailableTitle")),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByText(i18n.t("action.saveToNotebaseAccountUnavailableDescription")),
    ).toBeInTheDocument()
    expect(screen.getByText("Reader (reader@example.com)")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("action.saveToNotebaseCreateAndSaveShort") }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: i18n.t("action.saveToNotebaseConnectExisting") }),
    ).toBeInTheDocument()
  })

  it("shows the saved notebase name in the success toast and opens its URL from the toast action", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    renderButton(config, createConnectedAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

    await waitFor(() => {
      expect(toastManagerMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          title: i18n.t("action.saveToNotebaseSuccess"),
          description: "Summarize Notes",
          actionProps: expect.objectContaining({
            children: i18n.t("action.openNotebase"),
            onClick: expect.any(Function),
          }),
        }),
      )
    })

    const toastOptions = toastManagerMock.add.mock.calls[0]?.[0] as
      | { actionProps?: { onClick?: () => void }; description?: string }
      | undefined
    toastOptions?.actionProps?.onClick?.()

    expect(toastManagerMock.close).toHaveBeenCalledWith("toast-id")
    expect(sendMessage).toHaveBeenCalledWith("openPage", {
      url: expect.stringContaining("/notebase/notebase-1"),
      active: true,
    })
  })

  it("marks guide Dictionary Notebase complete after direct connected row save with guide tracking", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    guideTrackingMocks.canUseGuideDictionaryNotebaseTracking.mockReturnValue(true)
    guideTrackingMocks.getActiveGuideDictionaryNotebaseTrackingForAction.mockResolvedValue({
      id: "tracking-1",
      actionId: "default-dictionary",
      sourceUrl: "https://readfrog.app/guide/step-4",
      startedAt: 1_000,
      expiresAt: 1_801_000,
    })
    const action = createConnectedDictionaryAction()
    vi.mocked(orpcClient.notebase.getSchema).mockResolvedValueOnce(createSchemaForAction(action))
    renderButton(config, action)

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

    await waitFor(() => {
      expect(notebaseRowCreateMock).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith("completeGuideDictionaryNotebase", {
        trackingId: "tracking-1",
        actionId: "default-dictionary",
        notebaseId: "notebase-1",
        sourceUrl: "https://readfrog.app/guide/step-4",
      })
    })
  })

  it("sends the guide save context with the row and reports the save's steps", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    guideTrackingMocks.canUseGuideDictionaryNotebaseTracking.mockReturnValue(true)
    guideTrackingMocks.getActiveGuideDictionaryNotebaseTrackingForAction.mockResolvedValue({
      id: "tracking-1",
      actionId: "default-dictionary",
      sourceUrl: "https://readfrog.app/guide/step-4",
      startedAt: 1_000,
      expiresAt: 1_801_000,
    })
    const action = createConnectedDictionaryAction()
    vi.mocked(orpcClient.notebase.getSchema).mockResolvedValueOnce(createSchemaForAction(action))
    renderButton(config, action)

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

    await waitFor(() => {
      expect(notebaseRowCreateMock).toHaveBeenCalledWith(expect.anything(), {
        context: { analytics: { surface: "custom_action", isGuide: true } },
      })
    })
    expect(sendMessage).toHaveBeenCalledWith(
      "trackFeatureUsedEvent",
      expect.objectContaining({
        feature: "note_save",
        action_id: "save_requested",
        save_source: "custom_action",
        note_count: 1,
      }),
    )
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        "trackFeatureUsedEvent",
        expect.objectContaining({
          feature: "note_save",
          action_id: "save_completed",
          outcome: "success",
          path: "direct",
          is_guide: true,
        }),
      )
    })
  })

  it("reports a rejected direct save with its failure reason", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    notebaseRowCreateMock.mockRejectedValueOnce(
      new ORPCError("NOTE_LIMIT_EXCEEDED", { status: 403 }),
    )
    renderButton(config, createConnectedAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        "trackFeatureUsedEvent",
        expect.objectContaining({
          feature: "note_save",
          action_id: "save_completed",
          outcome: "failure",
          failure_reason: "note_limit",
          path: "direct",
          is_guide: false,
        }),
      )
    })
  })

  it("reports a save that failed before the row write", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    vi.mocked(orpcClient.notebase.list).mockRejectedValueOnce(new TypeError("Failed to fetch"))
    renderButton(config, createConnectedAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        "trackFeatureUsedEvent",
        expect.objectContaining({
          feature: "note_save",
          action_id: "save_completed",
          outcome: "failure",
          failure_reason: "network",
          path: "direct",
        }),
      )
    })
    expect(notebaseRowCreateMock).not.toHaveBeenCalled()
  })

  it("reports a create retried after a failure once, as the save that succeeded", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    vi.mocked(orpcClient.notebase.create).mockRejectedValueOnce(new TypeError("Failed to fetch"))
    renderButton(config, createAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("action.saveToNotebaseCreateAndSaveShort") }),
    )
    await waitFor(() => expect(toastManagerMock.add).toHaveBeenCalled())
    fireEvent.click(
      await screen.findByRole("button", {
        name: i18n.t("action.saveToNotebaseCreateAndSaveShort"),
      }),
    )

    await waitFor(() => expect(orpcClient.notebase.create).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(getNoteSaveCompletions()).toHaveLength(1))
    expect(getNoteSaveCompletions()[0]).toMatchObject({
      outcome: "success",
      path: "create_notebase",
    })
  })

  it("reports the last create failure once the user leaves the dialog", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    vi.mocked(orpcClient.notebase.create).mockRejectedValueOnce(
      new ORPCError("NOTE_LIMIT_EXCEEDED", { status: 403 }),
    )
    renderButton(config, createAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("action.saveToNotebaseCreateAndSaveShort") }),
    )
    await waitFor(() => expect(orpcClient.notebase.create).toHaveBeenCalledTimes(1))
    expect(getNoteSaveCompletions()).toHaveLength(0)

    fireEvent.click(
      await screen.findByRole("button", { name: i18n.t("action.saveToNotebaseConnectExisting") }),
    )

    expect(getNoteSaveCompletions()).toEqual([
      expect.objectContaining({
        outcome: "failure",
        failure_reason: "note_limit",
        path: "create_notebase",
      }),
    ])
  })

  it("reports a create dialog a signed-in user leaves without trying as dismissed", () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    renderButton(config, createAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("action.saveToNotebaseConnectExisting") }),
    )

    expect(getNoteSaveCompletions()).toEqual([
      expect.objectContaining({ outcome: "failure", failure_reason: "dismissed" }),
    ])
  })

  it("does not mark guide complete for default Dictionary saves outside guide step 3", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    guideTrackingMocks.canUseGuideDictionaryNotebaseTracking.mockReturnValue(false)
    const action = createConnectedDictionaryAction()
    vi.mocked(orpcClient.notebase.getSchema).mockResolvedValueOnce(createSchemaForAction(action))
    renderButton(config, action)

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

    await waitFor(() => {
      expect(notebaseRowCreateMock).toHaveBeenCalledTimes(1)
    })
    expect(sendMessage).not.toHaveBeenCalledWith(
      "completeGuideDictionaryNotebase",
      expect.anything(),
    )
  })

  it("does not mark guide complete for non-Dictionary custom actions", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    guideTrackingMocks.canUseGuideDictionaryNotebaseTracking.mockReturnValue(false)
    renderButton(config, createConnectedAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

    await waitFor(() => {
      expect(notebaseRowCreateMock).toHaveBeenCalledTimes(1)
    })
    expect(sendMessage).not.toHaveBeenCalledWith(
      "completeGuideDictionaryNotebase",
      expect.anything(),
    )
  })

  it("shows a Custom AI Actions toast action instead of disabling invalid mappings", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    vi.mocked(orpcClient.notebase.getSchema).mockResolvedValueOnce(createSchema("removed-column"))
    renderButton(config, createConnectedAction())

    const saveButton = screen.getByRole("button", { name: i18n.t("action.saveToNotebase") })
    expect(saveButton).toBeEnabled()
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(toastManagerMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: i18n.t("action.saveToNotebaseConnectionInvalid"),
          actionProps: expect.objectContaining({
            children: i18n.t("action.openCustomActions"),
            onClick: expect.any(Function),
          }),
        }),
      )
    })

    const toastOptions = toastManagerMock.add.mock.calls[0]?.[0] as
      | { actionProps?: { onClick?: () => void } }
      | undefined
    toastOptions?.actionProps?.onClick?.()

    expect(toastManagerMock.close).toHaveBeenCalledWith("toast-id")
    expect(sendMessage).toHaveBeenCalledWith("openOptionsPage", {
      route: "/custom-actions?actionId=action-1&tab=notebase",
    })
  })

  it("keeps the part of a failed run that streamed before the error out of the Notebase", () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    renderButton(config, createConnectedAction(), { failed: true })

    expect(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") })).toBeDisabled()
  })

  describe("undecided fields", () => {
    // Only the term is mapped, as on a connection that lost the rest.
    function createTermOnlyDictionaryAction() {
      const action = createConnectedDictionaryAction()
      action.notebaseConnection!.mappings = action.notebaseConnection!.mappings.slice(0, 1)
      return action
    }

    type WarningToast = {
      actionProps?: { onClick?: () => void }
      data?: { secondaryAction?: { onClick: () => void } }
    }

    async function saveAndGetWarning(action: SelectionToolbarCustomAction) {
      const config = cloneConfig(DEFAULT_CONFIG)
      config.betaExperience.enabled = true
      vi.mocked(orpcClient.notebase.getSchema).mockResolvedValueOnce(createSchemaForAction(action))
      const { store } = renderButton(config, action)
      fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))
      await waitFor(() => expect(toastManagerMock.add).toHaveBeenCalled())
      expect(notebaseRowCreateMock).toHaveBeenCalledTimes(1)
      return { store, toast: toastManagerMock.add.mock.calls[0]?.[0] as WarningToast }
    }

    it("names them with a choice to skip them or configure", async () => {
      const action = createTermOnlyDictionaryAction()
      const undecided = action.outputSchema.slice(1)

      await saveAndGetWarning(action)

      expect(toastManagerMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "warning",
          title: i18n.t("action.saveToNotebaseUndecidedTitle"),
          actionProps: expect.objectContaining({
            children: i18n.t("action.saveToNotebaseSkipUndecided"),
          }),
          data: {
            secondaryAction: expect.objectContaining({
              children: i18n.t("action.saveToNotebaseGoConfigure"),
            }),
          },
        }),
      )
      expect(vi.mocked(formatUiList)).toHaveBeenLastCalledWith(undecided.map((field) => field.name))
    })

    it("names them again on the next save while they stay undecided", async () => {
      const action = createTermOnlyDictionaryAction()
      const undecidedNames = action.outputSchema.slice(1).map((field) => field.name)
      const { store } = await saveAndGetWarning(action)

      // The reader closes the toast without choosing, and saves again.
      vi.mocked(orpcClient.notebase.getSchema).mockResolvedValueOnce(createSchemaForAction(action))
      fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

      await waitFor(() => expect(toastManagerMock.add).toHaveBeenCalledTimes(2))
      expect(toastManagerMock.add).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "warning" }),
      )
      expect(vi.mocked(formatUiList)).toHaveBeenLastCalledWith(undecidedNames)
      expect(getStoredDictionaryConnection(store)?.skippedFieldIds).toBeUndefined()
    })

    it("marks them don't save from the toast", async () => {
      const action = createTermOnlyDictionaryAction()
      const undecidedIds = action.outputSchema.slice(1).map((field) => field.id)
      const { store, toast } = await saveAndGetWarning(action)

      toast.actionProps?.onClick?.()

      expect(toastManagerMock.close).toHaveBeenCalledWith("toast-id")
      await waitFor(() =>
        expect(getStoredDictionaryConnection(store)?.skippedFieldIds).toEqual(undecidedIds),
      )
      expect(getStoredDictionaryConnection(store)?.mappings).toHaveLength(1)
    })

    // Changes the connection after the save, as another options tab would.
    async function changeStoredConnectionAfterSave(
      store: ReturnType<typeof createStore>,
      update: (
        connection: SelectionToolbarCustomActionNotebaseConnection,
      ) => SelectionToolbarCustomActionNotebaseConnection,
    ) {
      const { selectionToolbar } = cloneConfig(store.get(configAtom))
      const dictionary = selectionToolbar.builtInActions.dictionary
      dictionary.notebaseConnection = update(dictionary.notebaseConnection!)
      await act(() => store.set(configFieldsAtomMap.selectionToolbar, selectionToolbar))
    }

    it("leaves a connection to another Notebase alone", async () => {
      const action = createTermOnlyDictionaryAction()
      const { store, toast } = await saveAndGetWarning(action)
      await changeStoredConnectionAfterSave(store, (connection) => ({
        ...connection,
        notebaseId: "notebase-2",
      }))
      const before = getStoredDictionaryConnection(store)

      toast.actionProps?.onClick?.()

      await act(async () => {})
      expect(getStoredDictionaryConnection(store)).toEqual(before)
    })

    it("does not skip a field mapped after the save", async () => {
      const action = createTermOnlyDictionaryAction()
      const [, phonetic, ...rest] = action.outputSchema
      const { store, toast } = await saveAndGetWarning(action)
      await changeStoredConnectionAfterSave(store, (connection) =>
        mapNotebaseField(connection, phonetic!.id, { id: "column-ipa", name: "IPA" }),
      )

      toast.actionProps?.onClick?.()

      await waitFor(() =>
        expect(getStoredDictionaryConnection(store)?.skippedFieldIds).toEqual(
          rest.map((field) => field.id),
        ),
      )
      expect(getStoredDictionaryConnection(store)?.mappings).toContainEqual(
        expect.objectContaining({ localFieldId: phonetic!.id, notebaseColumnId: "column-ipa" }),
      )
    })

    it("opens the mappings from the toast", async () => {
      const action = createTermOnlyDictionaryAction()
      const { toast } = await saveAndGetWarning(action)

      toast.data?.secondaryAction?.onClick()

      expect(sendMessage).toHaveBeenCalledWith("openOptionsPage", {
        route: buildCustomActionOptionsRoute(action.id, { tab: "notebase" }),
      })
    })

    it.each([
      ["signed in", true],
      ["signed out", false],
    ])("says no field is saved when every field is skipped (%s)", async (_label, signedIn) => {
      if (!signedIn) {
        mockAuthState.session = null as unknown as typeof mockAuthState.session
      }
      const action = createConnectedDictionaryAction()
      action.notebaseConnection!.mappings = []
      action.notebaseConnection!.skippedFieldIds = action.outputSchema.map((field) => field.id)
      const config = cloneConfig(DEFAULT_CONFIG)
      config.betaExperience.enabled = true
      renderButton(config, action)

      fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

      // Not "the connection is out of date", and no login for a save that
      // could not write anything.
      await waitFor(() =>
        expect(toastManagerMock.add).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "error",
            title: i18n.t("action.saveToNotebaseNoFieldSaved"),
          }),
        ),
      )
      expect(screen.queryByText(i18n.t("action.saveToNotebaseLoginConnectedTitle"))).toBeNull()
      expect(orpcClient.notebase.getSchema).not.toHaveBeenCalled()
      expect(notebaseRowCreateMock).not.toHaveBeenCalled()
    })

    it("does not remind about skipped fields", async () => {
      const action = createTermOnlyDictionaryAction()
      action.notebaseConnection!.skippedFieldIds = action.outputSchema
        .slice(1)
        .map((field) => field.id)

      await saveAndGetWarning(action)

      expect(toastManagerMock.add).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success", title: i18n.t("action.saveToNotebaseSuccess") }),
      )
    })
  })

  it("blames the answer, not the connection, when the server rejects a cell", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    notebaseRowCreateMock.mockRejectedValueOnce(
      new ORPCError("CELL_VALIDATION_FAILED", { status: 422 }),
    )
    renderButton(config, createConnectedAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

    await waitFor(() => {
      expect(toastManagerMock.add).toHaveBeenCalledWith({
        type: "error",
        title: i18n.t("action.saveToNotebaseInvalidContent"),
      })
    })
  })

  it("shows an access denied toast for generic Notebase permission errors", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = false
    notebaseRowCreateMock.mockRejectedValueOnce(new ORPCError("FORBIDDEN", { status: 403 }))
    renderButton(config, createConnectedAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

    await waitFor(() => {
      expect(toastManagerMock.add).toHaveBeenCalledWith({
        type: "error",
        title: i18n.t("action.saveToNotebaseAccessDenied"),
      })
    })
  })

  it("shows an upgrade action when the backend rejects the save for quota", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = false
    notebaseRowCreateMock.mockRejectedValueOnce(
      new ORPCError("NOTE_LIMIT_EXCEEDED", { status: 403 }),
    )
    renderButton(config, createConnectedAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

    await waitFor(() => {
      expect(toastManagerMock.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: i18n.t("action.saveToNotebaseLimitExceeded"),
          actionProps: expect.objectContaining({
            children: i18n.t("action.upgrade"),
            onClick: expect.any(Function),
          }),
        }),
      )
    })

    const toastOptions = toastManagerMock.add.mock.calls[0]?.[0] as
      | { actionProps?: { onClick?: () => void } }
      | undefined
    toastOptions?.actionProps?.onClick?.()

    expect(toastManagerMock.close).toHaveBeenCalledWith("toast-id")
    expect(sendMessage).toHaveBeenCalledWith("openPage", {
      url: new URL("/pricing", env.WXT_WEBSITE_URL).toString(),
      active: true,
    })
  })

  it("closes the create/connect dialog when clicking outside", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    renderButton(config, createAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

    const overlay = document.querySelector("[data-slot='dialog-overlay']")
    expect(overlay).toBeInTheDocument()

    const mouseDownEvent = new MouseEvent("mousedown", { bubbles: true, button: 0 })
    Object.defineProperty(mouseDownEvent, "composedPath", {
      value: () => [overlay, document.body, document, window],
    })
    const clickEvent = new MouseEvent("click", { bubbles: true, button: 0 })
    Object.defineProperty(clickEvent, "composedPath", {
      value: () => [overlay, document.body, document, window],
    })

    act(() => {
      overlay!.dispatchEvent(mouseDownEvent)
      overlay!.dispatchEvent(clickEvent)
    })

    await waitFor(() => {
      expect(screen.queryByText(i18n.t("action.saveToNotebaseCreateTitle"))).not.toBeInTheDocument()
    })
  })
})
