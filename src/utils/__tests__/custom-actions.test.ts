import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  duplicateSelectionToolbarAction,
  findSelectionToolbarAction,
  getBuiltInDictionaryAction,
  getSelectionToolbarActions,
  replaceSelectionToolbarAction,
  resolveNoteSuggestionAction,
} from "@/utils/custom-actions"

function cloneSelectionToolbar() {
  return structuredClone(DEFAULT_CONFIG.selectionToolbar)
}

describe("selection toolbar built-in actions", () => {
  it("always resolves the built-in actions before custom actions", () => {
    const selectionToolbar = cloneSelectionToolbar()
    const dictionary = getBuiltInDictionaryAction(selectionToolbar)
    selectionToolbar.customActions = [
      {
        ...dictionary,
        id: "custom-action",
        name: "Custom",
      },
    ]

    expect(getSelectionToolbarActions(selectionToolbar).map((action) => action.id)).toEqual([
      "default-dictionary",
      "default-sentence-analysis",
      "default-improve-writing",
      "custom-action",
    ])
  })

  it("resolves the built-in Sentence Analysis from its stored state", () => {
    const selectionToolbar = cloneSelectionToolbar()
    selectionToolbar.builtInActions.sentenceAnalysis = {
      enabled: false,
      providerId: "openai-default",
    }

    const action = findSelectionToolbarAction(selectionToolbar, "default-sentence-analysis")
    expect(action).toMatchObject({
      id: "default-sentence-analysis",
      enabled: false,
      providerId: "openai-default",
      icon: "streamline-color:search-visual-flat",
    })
    expect(action?.outputSchema.map((field) => field.id)).toEqual([
      "default-sentence-analysis-annotations",
      "default-sentence-analysis-translation",
    ])
    expect(action?.layout).toContain("default-sentence-analysis-annotations")
  })

  it("resolves the built-in Improve Writing, on by default, from its stored state", () => {
    const selectionToolbar = cloneSelectionToolbar()
    const action = findSelectionToolbarAction(selectionToolbar, "default-improve-writing")
    expect(action).toMatchObject({
      id: "default-improve-writing",
      enabled: true,
      providerId: DEFAULT_CONFIG.selectionToolbar.builtInActions.improveWriting.providerId,
      icon: "streamline-color:ai-edit-spark-flat",
    })
    expect(action?.outputSchema.map((field) => field.id)).toEqual([
      "default-improve-writing-setting",
      "default-improve-writing-annotations",
      "default-improve-writing-improved",
      "default-improve-writing-summary",
    ])
    expect(action?.layout).toContain("default-improve-writing-annotations")

    selectionToolbar.builtInActions.improveWriting = {
      enabled: false,
      providerId: "openai-default",
    }
    expect(findSelectionToolbarAction(selectionToolbar, "default-improve-writing")).toMatchObject({
      enabled: false,
      providerId: "openai-default",
    })
  })

  it("persists only mutable state when replacing the built-in Sentence Analysis", () => {
    const selectionToolbar = cloneSelectionToolbar()
    const action = findSelectionToolbarAction(selectionToolbar, "default-sentence-analysis")!

    const next = replaceSelectionToolbarAction(selectionToolbar, {
      ...action,
      name: "Renamed",
      systemPrompt: "Changed",
      providerId: "openai-default",
      enabled: false,
    })

    expect(next.builtInActions).toEqual({
      dictionary: selectionToolbar.builtInActions.dictionary,
      sentenceAnalysis: {
        enabled: false,
        providerId: "openai-default",
        notebaseConnection: undefined,
      },
      improveWriting: selectionToolbar.builtInActions.improveWriting,
    })
    expect(next.customActions).toBe(selectionToolbar.customActions)
    expect(findSelectionToolbarAction(next, "default-sentence-analysis")).toMatchObject({
      name: action.name,
      systemPrompt: action.systemPrompt,
      providerId: "openai-default",
    })
  })

  it("persists only mutable state when replacing the built-in Dictionary", () => {
    const selectionToolbar = cloneSelectionToolbar()
    const dictionary = getBuiltInDictionaryAction(selectionToolbar)
    const connection = {
      notebaseId: "notebase-1",
      notebaseNameSnapshot: "Words",
      connectedAccount: {
        id: "account-1",
        name: "Reader",
        email: "reader@example.com",
        image: null,
      },
      mappings: [],
    }

    const next = replaceSelectionToolbarAction(selectionToolbar, {
      ...dictionary,
      name: "Attempted rename",
      prompt: "Attempted prompt edit",
      enabled: false,
      providerId: "openai-default",
      notebaseConnection: connection,
    })

    expect(next.builtInActions.dictionary).toEqual({
      enabled: false,
      providerId: "openai-default",
      notebaseConnection: connection,
    })
    expect(getBuiltInDictionaryAction(next)).toMatchObject({
      id: "default-dictionary",
      name: dictionary.name,
      prompt: dictionary.prompt,
      enabled: false,
      providerId: "openai-default",
      notebaseConnection: connection,
    })
    expect(next.customActions).toEqual([])
  })

  it("never persists the built-in Dictionary's layout", () => {
    const selectionToolbar = cloneSelectionToolbar()
    const dictionary = getBuiltInDictionaryAction(selectionToolbar)
    expect(dictionary.layout).toEqual(expect.any(String))

    const next = replaceSelectionToolbarAction(selectionToolbar, {
      ...dictionary,
      layout: "<p>Attempted layout edit</p>",
    })

    expect(next.builtInActions.dictionary).not.toHaveProperty("layout")
    expect(getBuiltInDictionaryAction(next).layout).toBe(dictionary.layout)
    expect(next.customActions).toEqual([])
  })

  it("stores a custom action's layout as given", () => {
    const selectionToolbar = cloneSelectionToolbar()
    const custom = {
      ...getBuiltInDictionaryAction(selectionToolbar),
      id: "custom-action",
      name: "Custom",
      layout: "<p>{{ Before }}</p>",
    }
    selectionToolbar.customActions = [custom]

    const next = replaceSelectionToolbarAction(selectionToolbar, {
      ...custom,
      layout: "<p>{{ After }}</p>",
    })

    expect(next.customActions[0]?.layout).toBe("<p>{{ After }}</p>")
  })

  it("copies the layout when duplicating", () => {
    const selectionToolbar = cloneSelectionToolbar()
    const dictionary = getBuiltInDictionaryAction(selectionToolbar)
    const custom = { ...dictionary, id: "custom-action", name: "Custom", layout: "<p>mine</p>" }

    expect(duplicateSelectionToolbarAction(dictionary, [dictionary]).layout).toBe(dictionary.layout)
    expect(duplicateSelectionToolbarAction(custom, [dictionary, custom]).layout).toBe("<p>mine</p>")
  })

  it("deep-copies enabled, provider, and the full connection into an editable action", () => {
    const selectionToolbar = cloneSelectionToolbar()
    selectionToolbar.builtInActions.dictionary = {
      enabled: false,
      providerId: "openai-default",
      notebaseConnection: {
        notebaseId: "notebase-1",
        notebaseNameSnapshot: "Words",
        connectedAccount: {
          id: "account-1",
          name: "Reader",
          email: "reader@example.com",
          image: null,
        },
        mappings: [
          {
            id: "mapping-1",
            localFieldId: "default-dictionary-term",
            notebaseColumnId: "column-1",
            notebaseColumnNameSnapshot: "Term",
          },
        ],
      },
    }
    const dictionary = getBuiltInDictionaryAction(selectionToolbar)
    const duplicate = duplicateSelectionToolbarAction(dictionary, [
      dictionary,
      { ...dictionary, id: "same-name", name: dictionary.name },
    ])

    expect(duplicate).toEqual({
      ...dictionary,
      id: expect.any(String),
      name: `${dictionary.name} 1`,
    })
    expect(duplicate.id).not.toBe(dictionary.id)
    expect(duplicate.notebaseConnection).not.toBe(dictionary.notebaseConnection)
    expect(duplicate.notebaseConnection?.mappings).not.toBe(dictionary.notebaseConnection?.mappings)
  })

  it("resolves the configured Note suggestion action even when it is disabled", () => {
    const selectionToolbar = cloneSelectionToolbar()
    const customAction = {
      ...getBuiltInDictionaryAction(selectionToolbar),
      id: "custom-save-action",
      name: "Custom Save",
      enabled: false,
    }
    selectionToolbar.customActions = [customAction]
    selectionToolbar.noteSuggestion.actionId = customAction.id

    expect(resolveNoteSuggestionAction(selectionToolbar)).toBe(customAction)
  })

  it("fails fast when the configured Note suggestion action violates the config invariant", () => {
    const selectionToolbar = cloneSelectionToolbar()
    selectionToolbar.noteSuggestion.actionId = "deleted-action"

    expect(() => resolveNoteSuggestionAction(selectionToolbar)).toThrow(
      'Note suggestion action "deleted-action" is missing from the validated configuration.',
    )
  })
})
