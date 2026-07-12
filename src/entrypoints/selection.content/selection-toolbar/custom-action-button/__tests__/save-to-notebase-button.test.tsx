// @vitest-environment jsdom
import type { NotebaseGetSchemaOutput } from "@read-frog/api-contract"
import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { ORPCError } from "@orpc/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { env } from "@/env"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
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

const toastMock = vi.hoisted(() => ({
  success: vi.fn<(...args: any[]) => any>(),
  error: vi.fn<(...args: any[]) => any>(),
}))

const notebaseRowCreateMock = vi.hoisted(() => vi.fn<(...args: any[]) => any>())
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

vi.mock("sonner", () => ({
  toast: toastMock,
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
    notebaseRow: {
      create: {
        mutationOptions: (options: unknown) => ({
          mutationFn: notebaseRowCreateMock,
          ...(options as object),
        }),
      },
    },
  },
  orpcClient: {
    notebase: {
      create: vi.fn<(...args: any[]) => any>(),
      getSchema: vi.fn<(...args: any[]) => any>(),
      list: vi.fn<(...args: any[]) => any>(),
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
        speaking: false,
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
  const action = cloneConfig(DEFAULT_CONFIG).selectionToolbar.customActions.find(
    (item) => item.id === "default-dictionary",
  )
  if (!action) {
    throw new Error("Default Dictionary action is not configured")
  }

  return action
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
      width: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  }
}

function renderButton(config: Config, action: SelectionToolbarCustomAction) {
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
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <SaveToNotebaseButton
          action={action}
          isRunning={false}
          result={{ summary: "A short summary" }}
        />
        <SaveToNotebaseDialogHost />
      </Provider>
    </QueryClientProvider>,
  )
}

describe("saveToNotebaseButton notebase availability", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toastMock.success.mockClear()
    toastMock.error.mockClear()
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
    vi.mocked(orpcClient.notebase.create).mockResolvedValue({ txid: 1 })
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
      expect(toastMock.error).toHaveBeenCalledWith(
        i18n.t("action.saveToNotebaseLimitExceeded"),
        expect.objectContaining({
          action: expect.objectContaining({
            label: i18n.t("action.upgrade"),
            onClick: expect.any(Function),
          }),
        }),
      )
    })

    const toastOptions = toastMock.error.mock.calls[0]?.[1] as
      | { action?: { onClick?: () => void } }
      | undefined
    toastOptions?.action?.onClick?.()

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
      sourceUrl: "https://readfrog.app/guide/step-3",
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
        sourceUrl: "https://readfrog.app/guide/step-3",
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
      expect(toastMock.success).toHaveBeenCalledWith(
        i18n.t("action.saveToNotebaseSuccess"),
        expect.objectContaining({
          description: "Summarize Notes",
          action: expect.objectContaining({
            label: i18n.t("action.openNotebase"),
            onClick: expect.any(Function),
          }),
        }),
      )
    })

    const toastOptions = toastMock.success.mock.calls[0]?.[1] as
      | { action?: { onClick?: () => void }; description?: string }
      | undefined
    toastOptions?.action?.onClick?.()

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
      sourceUrl: "https://readfrog.app/guide/step-3",
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
        sourceUrl: "https://readfrog.app/guide/step-3",
      })
    })
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
      expect(toastMock.error).toHaveBeenCalledWith(
        i18n.t("action.saveToNotebaseConnectionInvalid"),
        expect.objectContaining({
          action: expect.objectContaining({
            label: i18n.t("action.openCustomActions"),
            onClick: expect.any(Function),
          }),
        }),
      )
    })

    const toastOptions = toastMock.error.mock.calls[0]?.[1] as
      | { action?: { onClick?: () => void } }
      | undefined
    toastOptions?.action?.onClick?.()

    expect(sendMessage).toHaveBeenCalledWith("openOptionsPage", {
      route: "/custom-actions?actionId=action-1",
    })
  })

  it("shows an access denied toast for generic Notebase permission errors", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = false
    notebaseRowCreateMock.mockRejectedValueOnce(new ORPCError("FORBIDDEN", { status: 403 }))
    renderButton(config, createConnectedAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith(i18n.t("action.saveToNotebaseAccessDenied"))
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
      expect(toastMock.error).toHaveBeenCalledWith(
        i18n.t("action.saveToNotebaseLimitExceeded"),
        expect.objectContaining({
          action: expect.objectContaining({
            label: i18n.t("action.upgrade"),
            onClick: expect.any(Function),
          }),
        }),
      )
    })

    const toastOptions = toastMock.error.mock.calls[0]?.[1] as
      | { action?: { onClick?: () => void } }
      | undefined
    toastOptions?.action?.onClick?.()

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
