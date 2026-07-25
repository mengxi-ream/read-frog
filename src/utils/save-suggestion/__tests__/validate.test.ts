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
    providerId: "read-frog-free-ai",
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

function createDraft(): SelectionToolbarCustomAction {
  return createAction({ id: "draft-1", name: "Dictionary Draft" })
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
  const candidate = createAction()
  const dictionaryDraft = createDraft()

  function validate(
    action: {
      createNewDictionaryAction: boolean
      targetActionId: string | null
      summaryFieldName?: string | null
    },
    notes: SaveSuggestionNote[],
  ) {
    return validateSaveSuggestion({
      envelope: { action, notes },
      candidates: [candidate],
      dictionaryDraft,
    })
  }

  const validNote = note([
    { name: "Term", value: "ephemeral" },
    { name: "Definition", value: "lasting a very short time" },
    { name: "Difficulty", value: 4 },
  ])

  it("resolves an existing candidate action", () => {
    const result = validate({ createNewDictionaryAction: false, targetActionId: "action-1" }, [
      validNote,
    ])
    expect(result).toEqual({
      target: { kind: "existing", actionId: "action-1" },
      notes: [{ Term: "ephemeral", Definition: "lasting a very short time", Difficulty: 4 }],
      summaryFieldName: null,
    })
  })

  it("keeps a summary hint naming a non-primary field of the chosen action", () => {
    const result = validate(
      {
        createNewDictionaryAction: false,
        targetActionId: "action-1",
        summaryFieldName: "Definition",
      },
      [validNote],
    )
    expect(result?.summaryFieldName).toBe("Definition")
  })

  it("nulls a bad summary hint without discarding the suggestion", () => {
    const unknownField = validate(
      { createNewDictionaryAction: false, targetActionId: "action-1", summaryFieldName: "Bogus" },
      [validNote],
    )
    expect(unknownField).not.toBeNull()
    expect(unknownField?.summaryFieldName).toBeNull()

    const primaryField = validate(
      { createNewDictionaryAction: false, targetActionId: "action-1", summaryFieldName: "Term" },
      [validNote],
    )
    expect(primaryField).not.toBeNull()
    expect(primaryField?.summaryFieldName).toBeNull()
  })

  it("resolves the dictionary draft when createNewDictionaryAction is true, ignoring a stray id", () => {
    const result = validate({ createNewDictionaryAction: true, targetActionId: "action-1" }, [
      validNote,
    ])
    expect(result?.target).toEqual({ kind: "create_dictionary" })
  })

  it("rejects an unknown target action id", () => {
    expect(
      validate({ createNewDictionaryAction: false, targetActionId: "missing" }, [validNote]),
    ).toBeNull()
  })

  it("rejects when neither createNew nor a target id is provided", () => {
    expect(
      validate({ createNewDictionaryAction: false, targetActionId: null }, [validNote]),
    ).toBeNull()
  })

  it("rejects zero notes", () => {
    expect(
      validate({ createNewDictionaryAction: false, targetActionId: "action-1" }, []),
    ).toBeNull()
  })

  it("rejects the whole suggestion when any note has a type mismatch", () => {
    const badNote = note([
      { name: "Term", value: "ok" },
      { name: "Difficulty", value: "not a number" },
    ])
    expect(
      validate({ createNewDictionaryAction: false, targetActionId: "action-1" }, [
        validNote,
        badNote,
      ]),
    ).toBeNull()
  })

  it("rejects when the primary display field is null or blank", () => {
    const nullPrimary = note([{ name: "Definition", value: "def" }])
    const blankPrimary = note([
      { name: "Term", value: "   " },
      { name: "Definition", value: "def" },
    ])
    expect(
      validate({ createNewDictionaryAction: false, targetActionId: "action-1" }, [nullPrimary]),
    ).toBeNull()
    expect(
      validate({ createNewDictionaryAction: false, targetActionId: "action-1" }, [blankPrimary]),
    ).toBeNull()
  })

  it("accepts up to two valid notes", () => {
    const second = note([
      { name: "Term", value: "ubiquitous" },
      { name: "Definition", value: "found everywhere" },
      { name: "Difficulty", value: 3 },
    ])
    const result = validate({ createNewDictionaryAction: false, targetActionId: "action-1" }, [
      validNote,
      second,
    ])
    expect(result?.notes).toHaveLength(2)
    expect(result?.notes[1]?.Term).toBe("ubiquitous")
  })
})
