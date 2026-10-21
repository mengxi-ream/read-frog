import type { NotebaseRowCreateInput } from "@read-frog/api-contract"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getBuiltInDictionaryAction } from "@/utils/custom-actions"
import {
  sanitizeCustomActionNotebaseConnection,
  sanitizeSelectionToolbarCustomAction,
} from "../notebase/connection"
import {
  buildNotebaseRowCells,
  createNameMatchedNotebaseMappings,
  createNotebaseMapping,
  getUndecidedOutputFields,
  isNotebaseMappingCompatible,
  mapNotebaseField,
  markNotebaseFieldsReminded,
  resolveNotebaseMappings,
  skipNotebaseFields,
} from "../notebase/mapping"

type NotebaseColumn = Parameters<typeof createNameMatchedNotebaseMappings>[1][number]

function createColumn(id: string, name: string, config: NotebaseColumn["config"]): NotebaseColumn {
  return {
    id,
    notebaseId: "notebase-1",
    name,
    config,
    position: 0,
    isPrimary: false,
    wrap: false,
    width: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

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
      },
      {
        id: "field-score",
        name: "score",
        type: "number",
        description: "",
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

  it("maps fields to the columns that share their name and can hold their type", () => {
    const outputSchema = [
      ...createAction().outputSchema,
      { id: "field-notes", name: "notes", type: "string" as const, description: "" },
      { id: "field-tags", name: "tags", type: "string" as const, description: "" },
    ]
    const mappings = createNameMatchedNotebaseMappings(outputSchema, [
      // Names match ignoring case and surrounding spaces.
      createColumn("column-summary", " Summary ", { type: "string" }),
      // Same name, but a string column cannot hold a number.
      createColumn("column-score-text", "score", { type: "string" }),
      createColumn("column-score", "Score", { type: "number", decimal: 0, format: "number" }),
      // A column the reader named differently is left for them, not guessed.
      createColumn("column-remarks", "Remarks", { type: "string" }),
      createColumn("column-tags", "tags", { type: "select", options: [] }),
    ])

    expect(
      mappings.map(({ localFieldId, notebaseColumnId, notebaseColumnNameSnapshot }) => ({
        localFieldId,
        notebaseColumnId,
        notebaseColumnNameSnapshot,
      })),
    ).toEqual([
      {
        localFieldId: "field-summary",
        notebaseColumnId: "column-summary",
        notebaseColumnNameSnapshot: " Summary ",
      },
      {
        localFieldId: "field-score",
        notebaseColumnId: "column-score",
        notebaseColumnNameSnapshot: "Score",
      },
    ])
  })

  it("maps each column to one field only", () => {
    const outputSchema = [
      { id: "field-a", name: "Word", type: "string" as const, description: "" },
      { id: "field-b", name: "word", type: "string" as const, description: "" },
    ]
    const mappings = createNameMatchedNotebaseMappings(outputSchema, [
      createColumn("column-word", "Word", { type: "string" }),
    ])

    expect(mappings.map((mapping) => mapping.localFieldId)).toEqual(["field-a"])
  })

  describe("field decisions", () => {
    const outputSchema = [
      ...createAction().outputSchema,
      { id: "field-notes", name: "notes", type: "string" as const, description: "" },
    ]
    const connection = {
      notebaseId: "notebase-1",
      notebaseNameSnapshot: "Articles",
      connectedAccount,
      mappings: [createNotebaseMapping("field-summary", "column-summary", "Summary")],
    }
    const withConnection = (
      notebaseConnection: SelectionToolbarCustomAction["notebaseConnection"],
    ): SelectionToolbarCustomAction => ({ ...createAction(), outputSchema, notebaseConnection })
    const ids = (fields: { id: string }[]) => fields.map((field) => field.id)

    it("counts a field as undecided until it is mapped or skipped", () => {
      // An older connection has no skipped list: everything unmapped is undecided.
      expect(ids(getUndecidedOutputFields(withConnection(connection)))).toEqual([
        "field-score",
        "field-notes",
      ])
      expect(
        ids(
          getUndecidedOutputFields(
            withConnection({ ...connection, skippedFieldIds: ["field-notes"] }),
          ),
        ),
      ).toEqual(["field-score"])
      expect(getUndecidedOutputFields(withConnection(undefined))).toEqual([])
    })

    it("does not count a field whose column is gone as undecided", () => {
      // The mapping is invalid instead, which blocks the save until it is fixed.
      const action = withConnection(connection)
      expect(ids(getUndecidedOutputFields(action))).not.toContain("field-summary")
    })

    it("maps a field and forgets it was skipped or reminded about", () => {
      const next = mapNotebaseField(
        { ...connection, skippedFieldIds: ["field-score"], remindedFieldIds: ["field-notes"] },
        "field-score",
        { id: "column-score", name: "Score" },
      )

      expect(
        next.mappings.map((mapping) => [mapping.localFieldId, mapping.notebaseColumnId]),
      ).toEqual([
        ["field-summary", "column-summary"],
        ["field-score", "column-score"],
      ])
      expect(next.skippedFieldIds).toEqual([])
      expect(next.remindedFieldIds).toEqual(["field-notes"])

      const moved = mapNotebaseField(next, "field-summary", { id: "column-notes", name: "Notes" })
      expect(moved.mappings).toHaveLength(2)
      expect(moved.mappings[0]).toMatchObject({
        id: connection.mappings[0]!.id,
        notebaseColumnId: "column-notes",
        notebaseColumnNameSnapshot: "Notes",
      })
    })

    it("skips fields, dropping their mappings and reminders", () => {
      const next = skipNotebaseFields({ ...connection, remindedFieldIds: ["field-notes"] }, [
        "field-summary",
        "field-notes",
      ])

      expect(next.mappings).toEqual([])
      expect(next.skippedFieldIds).toEqual(["field-summary", "field-notes"])
      expect(next.remindedFieldIds).toEqual([])
    })

    it("records reminded fields once", () => {
      const once = markNotebaseFieldsReminded(connection, ["field-score"])
      expect(
        markNotebaseFieldsReminded(once, ["field-score", "field-notes"]).remindedFieldIds,
      ).toEqual(["field-score", "field-notes"])
    })

    it("keeps only lists that still name unmapped fields of the action", () => {
      const sanitized = sanitizeCustomActionNotebaseConnection(
        {
          ...connection,
          // Mapped, gone from the action, and duplicated ids all drop out.
          skippedFieldIds: ["field-summary", "field-gone", "field-score", "field-score"],
          // A skipped field is not undecided, so it is not "reminded" either.
          remindedFieldIds: ["field-score", "field-notes"],
        },
        outputSchema,
      )

      expect(sanitized?.skippedFieldIds).toEqual(["field-score"])
      expect(sanitized?.remindedFieldIds).toEqual(["field-notes"])
      // A connection without the lists reads exactly as before.
      expect(sanitizeCustomActionNotebaseConnection(connection, outputSchema)).not.toHaveProperty(
        "skippedFieldIds",
      )
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
