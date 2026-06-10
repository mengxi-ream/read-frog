// @vitest-environment jsdom
import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { i18n } from "#imports"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { sendMessage } from "@/utils/message"
import { orpcClient } from "@/utils/orpc/client"
import { SaveToNotebaseButton } from "../save-to-notebase-button"
import { SaveToNotebaseDialogHost } from "../save-to-notebase-dialog-host"

const mockAuthState = vi.hoisted(() => ({
  session: {
    user: {
      id: "user-1",
    },
  } as { user: { id: string } } | null,
  isPending: false,
}))

vi.mock("@/utils/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: mockAuthState.session,
      isPending: mockAuthState.isPending,
    }),
  },
}))

vi.mock("@/utils/notebase-beta", () => ({
  isORPCForbiddenError: () => false,
  useNotebaseBetaStatus: () => ({
    data: {
      allowed: true,
    },
    error: null,
    isPending: false,
  }),
}))

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn(),
}))

vi.mock("@/utils/orpc/client", () => ({
  orpc: {
    notebase: {
      getSchema: {
        queryOptions: (options: unknown) => ({
          queryKey: ["notebase", "schema"],
          queryFn: vi.fn(),
          ...(options as object),
        }),
      },
    },
    notebaseRow: {
      create: {
        mutationOptions: (options: unknown) => ({
          mutationFn: vi.fn(),
          ...(options as object),
        }),
      },
    },
  },
  orpcClient: {
    notebase: {
      create: vi.fn(),
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

function renderButton(config: Config, action: SelectionToolbarCustomAction) {
  const store = createStore()
  store.set(configAtom, config)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
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

describe("saveToNotebaseButton beta gating", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthState.session = {
      user: {
        id: "user-1",
      },
    }
    mockAuthState.isPending = false
    vi.mocked(orpcClient.notebase.create).mockResolvedValue({ txid: 1 })
    vi.mocked(sendMessage).mockResolvedValue(undefined as never)
  })

  it("does not render when beta experience is disabled", () => {
    const config = cloneConfig(DEFAULT_CONFIG)

    config.betaExperience.enabled = false
    renderButton(config, createAction())

    expect(screen.queryByRole("button", { name: i18n.t("action.saveToNotebase") })).not.toBeInTheDocument()
  })

  it("opens a create/connect dialog for an unconnected custom action", () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    renderButton(config, createAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))

    expect(screen.getByText(i18n.t("action.saveToNotebaseCreateTitle"))).toBeInTheDocument()
    expect(screen.getByRole("button", { name: i18n.t("action.saveToNotebaseCreateAndSave") })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: i18n.t("action.saveToNotebaseConnectExisting") })).toBeInTheDocument()
  })

  it("opens the created notebase after creating and saving", async () => {
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    renderButton(config, createAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))
    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebaseCreateAndSave") }))

    await waitFor(() => {
      expect(orpcClient.notebase.create).toHaveBeenCalledTimes(1)
    })

    const createInput = vi.mocked(orpcClient.notebase.create).mock.calls[0]?.[0] as { id: string } | undefined
    expect(createInput?.id).toBeTruthy()

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith("openPage", {
        url: expect.stringContaining(`/notebase/${encodeURIComponent(createInput!.id)}`),
        active: true,
      })
    })
  })

  it("redirects logged-out users to home while the background save opens the notebase later", async () => {
    mockAuthState.session = null
    const config = cloneConfig(DEFAULT_CONFIG)
    config.betaExperience.enabled = true
    renderButton(config, createAction())

    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebase") }))
    fireEvent.click(screen.getByRole("button", { name: i18n.t("action.saveToNotebaseLoginAndCreate") }))

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith("openPage", expect.objectContaining({
        active: true,
      }))
    })

    const openPageCall = vi.mocked(sendMessage).mock.calls.find(([message]) => message === "openPage")
    const loginUrl = new URL((openPageCall?.[1] as { url: string }).url)

    expect(loginUrl.pathname).toBe("/log-in")
    expect(loginUrl.searchParams.get("redirectTo")).toBe("/home")
    expect(loginUrl.searchParams.has("rfPending")).toBe(false)
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
