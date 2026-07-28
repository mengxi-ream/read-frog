import type { SaveSuggestionNote } from "../types"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { describe, expect, it } from "vitest"
import { notePairsToRecord, validateSaveSuggestion } from "../validate"

function createAction(
  overrides: Partial<SelectionToolbarCustomAction> = {},
): SelectionToolbarCustomAction {
  return {
    id: "action-1",
    name: "Dictionary",
    enabled: true,
    icon: "tabler:book-2",
    providerId: "openai-default",
    systemPrompt: "system",
    prompt: "prompt",
    outputSchema: [
      { id: "field-term", name: "Term", type: "string", description: "", speaking: true },
      {
        id: "field-definition",
        name: "Definition",
        type: "string",
        description: "",
        speaking: false,
      },
      {
        id: "field-difficulty",
        name: "Difficulty",
        type: "number",
        description: "",
        speaking: false,
      },
    ],
    ...overrides,
  }
}

function note(fields: Array<{ name: string; value: string | number | null }>): SaveSuggestionNote {
  return { fields }
}

describe("notePairsToRecord", () => {
  const outputSchema = createAction().outputSchema

  it("keeps known fields, drops unknown fields, and fills missing with null", () => {
    const record = notePairsToRecord(
      note([
        { name: "Term", value: "ephemeral" },
        { name: "Bogus", value: "x" },
      ]),
      outputSchema,
    )
    expect(record).toEqual({ Term: "ephemeral", Definition: null, Difficulty: null })
  })

  it("first occurrence wins for duplicated names, even when it is null", () => {
    const record = notePairsToRecord(
      note([
        { name: "Definition", value: null },
        { name: "Definition", value: "late duplicate" },
        { name: "Term", value: "first" },
        { name: "Term", value: "second" },
      ]),
      outputSchema,
    )
    expect(record.Definition).toBeNull()
    expect(record.Term).toBe("first")
  })
})

describe("validateSaveSuggestion", () => {
  const action = createAction()

  function validate(notes: SaveSuggestionNote[], summaryFieldName?: string | null) {
    return validateSaveSuggestion({
      envelope: { notes, summaryFieldName },
      action,
    })
  }

  const validNote = note([
    { name: "Term", value: "ephemeral" },
    { name: "Definition", value: "lasting a very short time" },
    { name: "Difficulty", value: 4 },
  ])

  it("validates notes against the fixed action snapshot", () => {
    const result = validate([validNote])

    expect(result).toEqual({
      notes: [{ Term: "ephemeral", Definition: "lasting a very short time", Difficulty: 4 }],
      summaryFieldName: null,
    })
  })

  it("keeps a summary hint naming a non-primary field of the action", () => {
    expect(validate([validNote], "Definition")?.summaryFieldName).toBe("Definition")
  })

  it("nulls a bad summary hint without discarding the suggestion", () => {
    const unknownField = validate([validNote], "Bogus")
    expect(unknownField).not.toBeNull()
    expect(unknownField?.summaryFieldName).toBeNull()

    const primaryField = validate([validNote], "Term")
    expect(primaryField).not.toBeNull()
    expect(primaryField?.summaryFieldName).toBeNull()
  })

  it("rejects zero notes", () => {
    expect(validate([])).toBeNull()
  })

  it("rejects the whole suggestion when any note has a type mismatch", () => {
    const badNote = note([
      { name: "Term", value: "ok" },
      { name: "Difficulty", value: "not a number" },
    ])

    expect(validate([validNote, badNote])).toBeNull()
  })

  it("rejects when the primary display field is null or blank", () => {
    const nullPrimary = note([{ name: "Definition", value: "def" }])
    const blankPrimary = note([
      { name: "Term", value: "   " },
      { name: "Definition", value: "def" },
    ])

    expect(validate([nullPrimary])).toBeNull()
    expect(validate([blankPrimary])).toBeNull()
  })

  it("accepts up to two valid notes", () => {
    const second = note([
      { name: "Term", value: "ubiquitous" },
      { name: "Definition", value: "found everywhere" },
      { name: "Difficulty", value: 3 },
    ])
    const result = validate([validNote, second])

    expect(result?.notes).toHaveLength(2)
    expect(result?.notes[1]?.Term).toBe("ubiquitous")
  })

  it("uses the supplied action schema rather than resolving another action", () => {
    const numericAction = createAction({
      id: "fixed-action",
      outputSchema: [
        {
          id: "field-score",
          name: "Score",
          type: "number",
          description: "",
          speaking: false,
        },
      ],
    })

    expect(
      validateSaveSuggestion({
        envelope: { notes: [note([{ name: "Score", value: 8 }])] },
        action: numericAction,
      }),
    ).toEqual({ notes: [{ Score: 8 }], summaryFieldName: null })
  })
})
