import type { NotebaseRowCreateInput } from "@read-frog/api-contract"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getBuiltInDictionaryAction } from "@/utils/custom-actions"
import { sanitizeSelectionToolbarCustomAction } from "../notebase/connection"
import {
  buildNotebaseRowCells,
  createNotebaseMapping,
  isNotebaseMappingCompatible,
  resolveNotebaseMappings,
} from "../notebase/mapping"

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

const connectedAccount = {
  id: "user-1",
  name: "Reader",
  email: "reader@example.com",
  image: null,
}

describe("notebase utils", () => {
  it("sanitizes invalid local mappings when output fields change", () => {
    const action = createAction()
    const mappedAction: SelectionToolbarCustomAction = {
      ...action,
      notebaseConnection: {
        notebaseId: "notebase-1",
        notebaseNameSnapshot: "Articles",
        connectedAccount,
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
        notebaseId: "notebase-1",
        notebaseNameSnapshot: "Articles",
        connectedAccount,
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
      notebaseColumns: [
        {
          id: "column-summary",
          notebaseId: "notebase-1",
          name: "Summary",
          config: { type: "string" },
          position: 0,
          isPrimary: false,
          wrap: false,
          width: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "column-date",
          notebaseId: "notebase-1",
          name: "Date",
          config: { type: "date" },
          position: 1,
          isPrimary: false,
          wrap: false,
          width: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    })

    expect(mappings.map((mapping) => mapping.status)).toEqual(["valid", "incompatible"])
  })

  it("builds row cells from valid mappings only", () => {
    const action: SelectionToolbarCustomAction = {
      ...createAction(),
      notebaseConnection: {
        notebaseId: "notebase-1",
        notebaseNameSnapshot: "Articles",
        connectedAccount,
        mappings: [
          createNotebaseMapping("field-summary", "column-summary", "Summary"),
          createNotebaseMapping("field-score", "column-date", "Date"),
        ],
      },
    }

    const { cells } = buildNotebaseRowCells(
      action,
      {
        id: "table-1",
        name: "Articles",
        updatedAt: new Date(),
        notebaseColumns: [
          {
            id: "column-summary",
            notebaseId: "notebase-1",
            name: "Summary",
            config: { type: "string" },
            position: 0,
            isPrimary: false,
            wrap: false,
            width: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "column-date",
            notebaseId: "notebase-1",
            name: "Date",
            config: { type: "date" },
            position: 1,
            isPrimary: false,
            wrap: false,
            width: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
      {
        summary: "A short summary",
        score: 9,
      },
    )

    const typedCells: NotebaseRowCreateInput["data"]["cells"] = cells

    expect(cells).toEqual({
      "column-summary": "A short summary",
    })
    expect(typedCells).toEqual({
      "column-summary": "A short summary",
    })
  })

  it("keeps existing Dictionary context ids mapped to the original Notebase columns", () => {
    const action = getBuiltInDictionaryAction(DEFAULT_CONFIG.selectionToolbar)
    const connectedAction: SelectionToolbarCustomAction = {
      ...action,
      outputSchema: action.outputSchema.map((field) => {
        if (field.id === "default-dictionary-context") {
          return { ...field, name: "Sentence" }
        }
        if (field.id === "default-dictionary-context-translation") {
          return { ...field, name: "Sentence Translation" }
        }
        return field
      }),
      notebaseConnection: {
        notebaseId: "notebase-1",
        notebaseNameSnapshot: "Words",
        connectedAccount,
        mappings: [
          createNotebaseMapping("default-dictionary-context", "column-paragraphs", "Paragraphs"),
          createNotebaseMapping(
            "default-dictionary-context-translation",
            "column-paragraphs-translation",
            "Paragraphs Translation",
          ),
        ],
      },
    }
    const schema = {
      id: "notebase-1",
      name: "Words",
      updatedAt: new Date(),
      notebaseColumns: [
        {
          id: "column-paragraphs",
          notebaseId: "notebase-1",
          name: "Paragraphs",
          config: { type: "string" as const },
          position: 0,
          isPrimary: false,
          wrap: false,
          width: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "column-paragraphs-translation",
          notebaseId: "notebase-1",
          name: "Paragraphs Translation",
          config: { type: "string" as const },
          position: 1,
          isPrimary: false,
          wrap: false,
          width: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    }

    expect(
      resolveNotebaseMappings(connectedAction, schema).map((mapping) => mapping.status),
    ).toEqual(["valid", "valid"])
    expect(
      buildNotebaseRowCells(connectedAction, schema, {
        Sentence: "The selected term appears in this sentence.",
        "Sentence Translation": "所选词语出现在这个句子中。",
      }).cells,
    ).toEqual({
      "column-paragraphs": "The selected term appears in this sentence.",
      "column-paragraphs-translation": "所选词语出现在这个句子中。",
    })
  })

  it("only allows string and number columns", () => {
    expect(isNotebaseMappingCompatible("string", { type: "string" })).toBe(true)
    expect(
      isNotebaseMappingCompatible("number", { type: "number", decimal: 0, format: "number" }),
    ).toBe(true)
    expect(isNotebaseMappingCompatible("string", { type: "date" })).toBe(false)
    expect(isNotebaseMappingCompatible("number", { type: "select", options: [] })).toBe(false)
  })
})
