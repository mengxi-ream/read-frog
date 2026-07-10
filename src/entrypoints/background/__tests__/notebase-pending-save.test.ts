import type { NotebaseGetSchemaOutput } from "@read-frog/api-contract"
import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { PendingCreateNotebaseSave, PendingNotebaseSave } from "@/utils/notebase/pending-save"
import { describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  buildNotebaseCreateInputFromPending,
  createPendingConnectedNotebaseSave,
  createPendingNotebaseSave,
} from "@/utils/notebase/pending-save"
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
    getPendingNotebaseSave: vi.fn<(...args: any[]) => any>().mockResolvedValue(pending),
    clearPendingNotebaseSave: vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
    getConfig: vi.fn<(...args: any[]) => any>().mockResolvedValue(config),
    setConfig: vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
    getAuthenticatedAccount: vi
      .fn<(...args: any[]) => any>()
      .mockResolvedValue(
        authenticated
          ? { id: "user-1", name: "Reader", email: "reader@example.com", image: null }
          : null,
      ),
    createNotebase: vi.fn<(...args: any[]) => any>().mockResolvedValue({ txid: 1 }),
    createRow: vi.fn<(...args: any[]) => any>().mockResolvedValue({ txid: 1 }),
    listNotebases: vi
      .fn<(...args: any[]) => any>()
      .mockResolvedValue([{ id: "notebase-1", name: "Summarize Notes" }]),
    getSchema: vi.fn<(...args: any[]) => any>(),
    openNotebasePage: vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
    openActionOptions: vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
    completeGuideDictionaryNotebase: vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
    now: () => 1_000,
    log: {
      info: vi.fn<(...args: any[]) => any>(),
      warn: vi.fn<(...args: any[]) => any>(),
      error: vi.fn<(...args: any[]) => any>(),
    },
  }
}

function createMatchingSchema(pending: PendingCreateNotebaseSave): NotebaseGetSchemaOutput {
  return {
    id: pending.notebaseId,
    name: pending.actionName,
    updatedAt: new Date(),
    notebaseColumns: pending.columns.map((column, index) => ({
      id: column.notebaseColumnId,
      notebaseId: pending.notebaseId,
      name: column.notebaseColumnName,
      config:
        column.localFieldType === "number"
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

function createConnectedSchema(): NotebaseGetSchemaOutput {
  return {
    id: "notebase-1",
    name: "Summarize Notes",
    updatedAt: new Date(),
    notebaseColumns: [
      {
        id: "column-summary",
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

describe("notebase pending save processor", () => {
  it("clears schema-changed pending saves without probing auth or calling create", async () => {
    const action = createAction()
    const pending = createPendingNotebaseSave(action, { summary: "A short summary" }, 1_000)
    const deps = createDeps({
      pending,
      config: createConfig({
        ...action,
        outputSchema: [{ ...action.outputSchema[0], name: "changed" }],
      }),
      authenticated: true,
    })

    await createNotebasePendingSaveProcessor(deps)("startup")

    expect(deps.clearPendingNotebaseSave).toHaveBeenCalledTimes(1)
    expect(deps.getAuthenticatedAccount).not.toHaveBeenCalled()
    expect(deps.createNotebase).not.toHaveBeenCalled()
    expect(deps.openNotebasePage).not.toHaveBeenCalled()
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
    expect(loggedOutDeps.clearPendingNotebaseSave).not.toHaveBeenCalled()
    expect(loggedOutDeps.openNotebasePage).not.toHaveBeenCalled()

    const loggedInDeps = createDeps({
      pending,
      config: createConfig(action),
      authenticated: true,
    })

    await createNotebasePendingSaveProcessor(loggedInDeps)("auth-cookie-change")

    expect(loggedInDeps.createNotebase).toHaveBeenCalledWith(
      buildNotebaseCreateInputFromPending(pending),
    )
    expect(loggedInDeps.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
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
      }),
    )
    expect(loggedInDeps.clearPendingNotebaseSave).toHaveBeenCalledTimes(1)
    expect(loggedInDeps.openNotebasePage).toHaveBeenCalledWith(pending.notebaseId)
    expect(loggedInDeps.completeGuideDictionaryNotebase).not.toHaveBeenCalled()
  })

  it("completes the guide Dictionary Notebase flow after pending create resume when guide metadata is present", async () => {
    const action = {
      ...createAction(),
      id: "default-dictionary",
      name: "Dictionary",
    }
    const pending = createPendingNotebaseSave(action, { summary: "A short summary" }, 1_000, {
      guideDictionaryNotebaseTracking: {
        id: "tracking-1",
        actionId: "default-dictionary",
        sourceUrl: "https://readfrog.app/guide/step-3",
        startedAt: 1_000,
        expiresAt: 1_801_000,
      },
    })
    const deps = createDeps({
      pending,
      config: createConfig(action),
      authenticated: true,
    })

    await createNotebasePendingSaveProcessor(deps)("auth-cookie-change")

    expect(deps.createNotebase).toHaveBeenCalledWith(buildNotebaseCreateInputFromPending(pending))
    expect(deps.completeGuideDictionaryNotebase).toHaveBeenCalledWith({
      trackingId: "tracking-1",
      actionId: "default-dictionary",
      notebaseId: pending.notebaseId,
      sourceUrl: "https://readfrog.app/guide/step-3",
    })
  })

  it("opens the notebase page after duplicate-create recovery succeeds", async () => {
    const action = createAction()
    const pending = createPendingNotebaseSave(action, { summary: "A short summary" }, 1_000)
    const deps = createDeps({
      pending,
      config: createConfig(action),
      authenticated: true,
    })
    deps.createNotebase.mockRejectedValueOnce(new Error("duplicate"))
    deps.getSchema.mockResolvedValueOnce(createMatchingSchema(pending))

    await createNotebasePendingSaveProcessor(deps)("auth-cookie-change")

    expect(deps.setConfig).toHaveBeenCalledTimes(1)
    expect(deps.clearPendingNotebaseSave).toHaveBeenCalledTimes(1)
    expect(deps.openNotebasePage).toHaveBeenCalledWith(pending.notebaseId)
  })

  it("saves a connected pending row when the logged-in account still owns the connection", async () => {
    const action = createConnectedAction()
    const pending = createPendingConnectedNotebaseSave(
      action,
      action.notebaseConnection!,
      { summary: "A short summary" },
      1_000,
    )
    const deps = createDeps({
      pending,
      config: createConfig(action),
      authenticated: true,
    })
    deps.getSchema.mockResolvedValueOnce(createConnectedSchema())

    await createNotebasePendingSaveProcessor(deps)("auth-cookie-change")

    expect(deps.createRow).toHaveBeenCalledWith({
      notebaseId: "notebase-1",
      data: {
        cells: {
          "column-summary": "A short summary",
        },
      },
    })
    expect(deps.createNotebase).not.toHaveBeenCalled()
    expect(deps.clearPendingNotebaseSave).toHaveBeenCalledTimes(1)
    expect(deps.openNotebasePage).toHaveBeenCalledWith("notebase-1")
    expect(deps.completeGuideDictionaryNotebase).not.toHaveBeenCalled()
  })

  it("completes the guide Dictionary Notebase flow after connected pending row resume when guide metadata is present", async () => {
    const action = {
      ...createConnectedAction(),
      id: "default-dictionary",
      name: "Dictionary",
    }
    const pending = createPendingConnectedNotebaseSave(
      action,
      action.notebaseConnection!,
      { summary: "A short summary" },
      1_000,
      {
        guideDictionaryNotebaseTracking: {
          id: "tracking-1",
          actionId: "default-dictionary",
          sourceUrl: "https://readfrog.app/guide/step-3",
          startedAt: 1_000,
          expiresAt: 1_801_000,
        },
      },
    )
    const deps = createDeps({
      pending,
      config: createConfig(action),
      authenticated: true,
    })
    deps.getSchema.mockResolvedValueOnce(createConnectedSchema())

    await createNotebasePendingSaveProcessor(deps)("auth-cookie-change")

    expect(deps.createRow).toHaveBeenCalledTimes(1)
    expect(deps.completeGuideDictionaryNotebase).toHaveBeenCalledWith({
      trackingId: "tracking-1",
      actionId: "default-dictionary",
      notebaseId: "notebase-1",
      sourceUrl: "https://readfrog.app/guide/step-3",
    })
  })

  it("creates a replacement Notebase for a connected pending save when the logged-in account differs", async () => {
    const action = createConnectedAction()
    const pending = createPendingConnectedNotebaseSave(
      action,
      action.notebaseConnection!,
      { summary: "A short summary" },
      1_000,
    )
    const deps = createDeps({
      pending,
      config: createConfig(action),
      authenticated: true,
    })
    deps.getAuthenticatedAccount.mockResolvedValueOnce({
      id: "user-2",
      name: "Other Reader",
      email: "other@example.com",
      image: null,
    })
    deps.listNotebases.mockResolvedValueOnce([])

    await createNotebasePendingSaveProcessor(deps)("auth-cookie-change")

    expect(deps.createRow).not.toHaveBeenCalled()
    expect(deps.createNotebase).toHaveBeenCalledTimes(1)
    expect(deps.setConfig).toHaveBeenCalledTimes(1)

    const nextConfig = deps.setConfig.mock.calls[0]?.[0] as Config
    const nextConnection = nextConfig.selectionToolbar.customActions[0]?.notebaseConnection
    expect(nextConnection?.notebaseId).not.toBe("notebase-1")
    expect(nextConnection?.connectedAccount).toMatchObject({
      id: "user-2",
      email: "other@example.com",
    })
    expect(deps.clearPendingNotebaseSave).toHaveBeenCalledTimes(1)
    expect(deps.completeGuideDictionaryNotebase).not.toHaveBeenCalled()
  })

  it("carries guide metadata into connected pending replacement creates", async () => {
    const action = {
      ...createConnectedAction(),
      id: "default-dictionary",
      name: "Dictionary",
    }
    const pending = createPendingConnectedNotebaseSave(
      action,
      action.notebaseConnection!,
      { summary: "A short summary" },
      1_000,
      {
        guideDictionaryNotebaseTracking: {
          id: "tracking-1",
          actionId: "default-dictionary",
          sourceUrl: "https://readfrog.app/guide/step-3",
          startedAt: 1_000,
          expiresAt: 1_801_000,
        },
      },
    )
    const deps = createDeps({
      pending,
      config: createConfig(action),
      authenticated: true,
    })
    deps.getAuthenticatedAccount.mockResolvedValueOnce({
      id: "user-2",
      name: "Other Reader",
      email: "other@example.com",
      image: null,
    })
    deps.listNotebases.mockResolvedValueOnce([])

    await createNotebasePendingSaveProcessor(deps)("auth-cookie-change")

    expect(deps.createRow).not.toHaveBeenCalled()
    expect(deps.createNotebase).toHaveBeenCalledTimes(1)
    expect(deps.completeGuideDictionaryNotebase).toHaveBeenCalledWith({
      trackingId: "tracking-1",
      actionId: "default-dictionary",
      notebaseId: expect.any(String),
      sourceUrl: "https://readfrog.app/guide/step-3",
    })
  })
})
