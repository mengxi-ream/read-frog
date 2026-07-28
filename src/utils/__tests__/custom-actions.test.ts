import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  duplicateSelectionToolbarAction,
  getBuiltInDictionaryAction,
  getSelectionToolbarActions,
  replaceSelectionToolbarAction,
  resolveSaveSuggestionAction,
} from "@/utils/custom-actions"

function cloneSelectionToolbar() {
  return structuredClone(DEFAULT_CONFIG.selectionToolbar)
}

describe("selection toolbar built-in actions", () => {
  it("always resolves Dictionary before custom actions", () => {
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
      "custom-action",
    ])
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

  it("resolves the configured Save Suggestion action even when it is disabled", () => {
    const selectionToolbar = cloneSelectionToolbar()
    const customAction = {
      ...getBuiltInDictionaryAction(selectionToolbar),
      id: "custom-save-action",
      name: "Custom Save",
      enabled: false,
    }
    selectionToolbar.customActions = [customAction]
    selectionToolbar.saveSuggestion.actionId = customAction.id

    expect(resolveSaveSuggestionAction(selectionToolbar)).toBe(customAction)
  })

  it("falls back to the built-in Dictionary when the configured action no longer exists", () => {
    const selectionToolbar = cloneSelectionToolbar()
    selectionToolbar.builtInActions.dictionary.enabled = false
    selectionToolbar.saveSuggestion.actionId = "deleted-action"

    expect(resolveSaveSuggestionAction(selectionToolbar)).toEqual(
      getBuiltInDictionaryAction(selectionToolbar),
    )
    expect(resolveSaveSuggestionAction(selectionToolbar).enabled).toBe(false)
  })
})
