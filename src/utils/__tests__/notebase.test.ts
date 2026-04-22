import type { RowCreateInput } from "@read-frog/api-contract"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { describe, expect, it } from "vitest"
import {
  buildNotebaseRowCells,
  createNotebaseMapping,
  isNotebaseMappingCompatible,
  resolveNotebaseMappings,
  sanitizeSelectionToolbarCustomAction,
} from "../notebase"

function createAction(): SelectionToolbarCustomAction {
  return {
    id: "action-1",
    name: "Custom AI Action",
    icon: "tabler:bolt",
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
    notebaseConnection: undefined,
  }
}

describe("notebase utils", () => {
  it("sanitizes invalid local mappings when output fields change", () => {
    const action = createAction()
    const mappedAction: SelectionToolbarCustomAction = {
      ...action,
      notebaseConnection: {
        tableId: "table-1",
        tableNameSnapshot: "Articles",
        mappings: [
          createNotebaseMapping("field-summary", "column-summary", "Summary"),
          createNotebaseMapping("field-missing", "column-score", "Score"),
        ],
      },
    }

    const sanitized = sanitizeSelectionToolbarCustomAction(mappedAction)

    expect(sanitized.notebaseConnection?.mappings).toHaveLength(1)
    expect(sanitized.notebaseConnection?.mappings[0]?.localFieldId).toBe("field-summary")
  })

  it("resolves valid and invalid mapping states from remote schema", () => {
    const action: SelectionToolbarCustomAction = {
      ...createAction(),
      notebaseConnection: {
        tableId: "table-1",
        tableNameSnapshot: "Articles",
        mappings: [
          createNotebaseMapping("field-summary", "column-summary", "Summary"),
          createNotebaseMapping("field-score", "column-date", "Date"),
        ],
      },
    }

    const mappings = resolveNotebaseMappings(action, {
      id: "table-1",
      name: "Articles",
      updatedAt: new Date(),
      columns: [
        {
          id: "column-summary",
          tableId: "table-1",
          name: "Summary",
          config: { type: "string" },
          position: 0,
          isPrimary: false,
          width: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "column-date",
          tableId: "table-1",
          name: "Date",
          config: { type: "date" },
          position: 1,
          isPrimary: false,
          width: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    })

    expect(mappings.map(mapping => mapping.status)).toEqual(["valid", "incompatible"])
  })

  it("builds row cells from valid mappings only", () => {
    const action: SelectionToolbarCustomAction = {
      ...createAction(),
      notebaseConnection: {
        tableId: "table-1",
        tableNameSnapshot: "Articles",
        mappings: [
          createNotebaseMapping("field-summary", "column-summary", "Summary"),
          createNotebaseMapping("field-score", "column-date", "Date"),
        ],
      },
    }

    const { cells } = buildNotebaseRowCells(action, {
      id: "table-1",
      name: "Articles",
      updatedAt: new Date(),
      columns: [
        {
          id: "column-summary",
          tableId: "table-1",
          name: "Summary",
          config: { type: "string" },
          position: 0,
          isPrimary: false,
          width: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "column-date",
          tableId: "table-1",
          name: "Date",
          config: { type: "date" },
          position: 1,
          isPrimary: false,
          width: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    }, {
      summary: "A short summary",
      score: 9,
    })

    const typedCells: RowCreateInput["data"]["cells"] = cells

    expect(cells).toEqual({
      "column-summary": "A short summary",
    })
    expect(typedCells).toEqual({
      "column-summary": "A short summary",
    })
  })

  it("only allows string and number columns", () => {
    expect(isNotebaseMappingCompatible("string", { type: "string" })).toBe(true)
    expect(isNotebaseMappingCompatible("number", { type: "number", decimal: 0, format: "number" })).toBe(true)
    expect(isNotebaseMappingCompatible("string", { type: "date" })).toBe(false)
    expect(isNotebaseMappingCompatible("number", { type: "select", options: [] })).toBe(false)
  })
})
