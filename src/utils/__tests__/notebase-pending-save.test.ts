import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  applyCreatedNotebaseConnectionToConfig,
  buildNotebaseCreateInputFromPending,
  createPendingNotebaseSave,
  doesSchemaMatchPendingColumns,
  getNotebaseDetailUrl,
  getOutputSchemaFingerprint,
  validateStillCanSavePendingCreateNotebaseSave,
} from "../notebase/pending-save"

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
      {
        id: "field-score",
        name: "score",
        type: "number",
        description: "",
        speaking: false,
      },
    ],
  }
}

describe("notebase pending save", () => {
  it("fingerprints only output field id, name, and type", () => {
    expect(getOutputSchemaFingerprint(createAction().outputSchema)).toBe(JSON.stringify([
      { id: "field-summary", name: "summary", type: "string" },
      { id: "field-score", name: "score", type: "number" },
    ]))
  })

  it("creates a pending payload and Notebase create input with one-to-one columns", () => {
    const pending = createPendingNotebaseSave(createAction(), {
      summary: "A short summary",
      score: 9,
    }, 1_000)

    expect(pending.actionId).toBe("action-1")
    expect(pending.actionName).toBe("Summarize")
    expect(pending.createdAt).toBe(1_000)
    expect(pending.expiresAt).toBe(601_000)
    expect(pending.columns.map(column => ({
      localFieldId: column.localFieldId,
      localFieldName: column.localFieldName,
      localFieldType: column.localFieldType,
      notebaseColumnName: column.notebaseColumnName,
    }))).toEqual([
      {
        localFieldId: "field-summary",
        localFieldName: "summary",
        localFieldType: "string",
        notebaseColumnName: "summary",
      },
      {
        localFieldId: "field-score",
        localFieldName: "score",
        localFieldType: "number",
        notebaseColumnName: "score",
      },
    ])
    expect(pending.cells).toEqual({
      [pending.columns[0]!.notebaseColumnId]: "A short summary",
      [pending.columns[1]!.notebaseColumnId]: 9,
    })

    expect(buildNotebaseCreateInputFromPending(pending)).toEqual({
      id: pending.notebaseId,
      name: "Summarize",
      options: {
        initialColumns: [
          {
            id: pending.columns[0]!.notebaseColumnId,
            name: "summary",
            config: { type: "string" },
          },
          {
            id: pending.columns[1]!.notebaseColumnId,
            name: "score",
            config: { type: "number", decimal: 0, format: "number" },
          },
        ],
        initialRow: {
          id: pending.rowId,
          cells: pending.cells,
        },
      },
    })
  })

  it("builds the website detail URL from the pending notebase id", () => {
    const notebaseId = "11111111-1111-4111-8111-111111111111"
    const url = new URL(getNotebaseDetailUrl(notebaseId))

    expect(url.pathname).toBe(`/notebase/${notebaseId}`)
  })

  it("writes a notebase connection into the matching action config", () => {
    const action = createAction()
    const config = cloneConfig(DEFAULT_CONFIG)
    config.selectionToolbar.customActions = [action]
    const pending = createPendingNotebaseSave(action, { summary: "A short summary", score: 9 }, 1_000)
    const connectedAccount = {
      id: "user-1",
      name: "Reader",
      email: "reader@example.com",
      image: null,
    }

    const result = applyCreatedNotebaseConnectionToConfig(config, pending, { connectedAccount })

    expect(result.status).toBe("valid")
    expect(result.config?.selectionToolbar.customActions[0]?.notebaseConnection).toMatchObject({
      notebaseId: pending.notebaseId,
      notebaseNameSnapshot: "Summarize",
      connectedAccount,
      mappings: [
        {
          localFieldId: "field-summary",
          notebaseColumnId: pending.columns[0]!.notebaseColumnId,
          notebaseColumnNameSnapshot: "summary",
        },
        {
          localFieldId: "field-score",
          notebaseColumnId: pending.columns[1]!.notebaseColumnId,
          notebaseColumnNameSnapshot: "score",
        },
      ],
    })
  })

  it("detects changed schemas before applying pending work", () => {
    const action = createAction()
    const config = cloneConfig(DEFAULT_CONFIG)
    config.selectionToolbar.customActions = [{
      ...action,
      outputSchema: [
        {
          ...action.outputSchema[0]!,
          name: "changed",
        },
        action.outputSchema[1]!,
      ],
    }]
    const pending = createPendingNotebaseSave(action, { summary: "A short summary", score: 9 }, 1_000)

    expect(validateStillCanSavePendingCreateNotebaseSave(config, pending).status).toBe("schema_changed")
  })

  it("matches duplicate-recovery schema exactly", () => {
    const pending = createPendingNotebaseSave(createAction(), {
      summary: "A short summary",
      score: 9,
    }, 1_000)

    expect(doesSchemaMatchPendingColumns({
      id: pending.notebaseId,
      name: pending.actionName,
      updatedAt: new Date(),
      notebaseColumns: pending.columns.map((column, index) => ({
        id: column.notebaseColumnId,
        notebaseId: pending.notebaseId,
        name: column.notebaseColumnName,
        config: column.localFieldType === "number"
          ? { type: "number", decimal: 0, format: "number" }
          : { type: "string" },
        position: index,
        isPrimary: index === 0,
        width: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    }, pending)).toBe(true)
  })
})
