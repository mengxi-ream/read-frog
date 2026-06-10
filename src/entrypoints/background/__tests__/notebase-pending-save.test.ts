import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { PendingNotebaseSave } from "@/utils/notebase-pending-save"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  buildNotebaseCreateInputFromPending,
  createPendingNotebaseSave,

} from "@/utils/notebase-pending-save"
import { createNotebasePendingSaveProcessor } from "../notebase-pending-save"

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

function createConfig(action: SelectionToolbarCustomAction) {
  const config = cloneConfig(DEFAULT_CONFIG)
  config.selectionToolbar.customActions = [action]
  return config
}

function createDeps({
  pending,
  config,
  authenticated,
}: {
  pending: PendingNotebaseSave
  config: Config
  authenticated: boolean
}) {
  return {
    getPending: vi.fn().mockResolvedValue(pending),
    clearPending: vi.fn().mockResolvedValue(undefined),
    getConfig: vi.fn().mockResolvedValue(config),
    setConfig: vi.fn().mockResolvedValue(undefined),
    hasAuthenticatedSession: vi.fn().mockResolvedValue(authenticated),
    createNotebase: vi.fn().mockResolvedValue({ txid: 1 }),
    getSchema: vi.fn(),
    now: () => 1_000,
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }
}

describe("notebase pending save processor", () => {
  it("clears schema-changed pending saves without probing auth or calling create", async () => {
    const action = createAction()
    const pending = createPendingNotebaseSave(action, { summary: "A short summary" }, 1_000)
    const deps = createDeps({
      pending,
      config: createConfig({
        ...action,
        outputSchema: [{ ...action.outputSchema[0]!, name: "changed" }],
      }),
      authenticated: true,
    })

    await createNotebasePendingSaveProcessor(deps)("startup")

    expect(deps.clearPending).toHaveBeenCalledTimes(1)
    expect(deps.hasAuthenticatedSession).not.toHaveBeenCalled()
    expect(deps.createNotebase).not.toHaveBeenCalled()
  })

  it("keeps pending work while logged out and resumes after auth", async () => {
    const action = createAction()
    const pending = createPendingNotebaseSave(action, { summary: "A short summary" }, 1_000)
    const loggedOutDeps = createDeps({
      pending,
      config: createConfig(action),
      authenticated: false,
    })

    await createNotebasePendingSaveProcessor(loggedOutDeps)("startup")

    expect(loggedOutDeps.createNotebase).not.toHaveBeenCalled()
    expect(loggedOutDeps.clearPending).not.toHaveBeenCalled()

    const loggedInDeps = createDeps({
      pending,
      config: createConfig(action),
      authenticated: true,
    })

    await createNotebasePendingSaveProcessor(loggedInDeps)("auth-cookie-change")

    expect(loggedInDeps.createNotebase).toHaveBeenCalledWith(buildNotebaseCreateInputFromPending(pending))
    expect(loggedInDeps.setConfig).toHaveBeenCalledWith(expect.objectContaining({
      selectionToolbar: expect.objectContaining({
        customActions: [
          expect.objectContaining({
            id: "action-1",
            notebaseConnection: expect.objectContaining({
              notebaseId: pending.notebaseId,
            }),
          }),
        ],
      }),
    }))
    expect(loggedInDeps.clearPending).toHaveBeenCalledTimes(1)
  })
})
