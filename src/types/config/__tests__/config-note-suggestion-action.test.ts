import { describe, expect, it } from "vitest"
import { createDefaultDictionaryAction, DEFAULT_CONFIG } from "@/utils/constants/config"
import { configSchema } from "../config"

function createConfigWithCustomSaveAction(enabled: boolean) {
  const action = createDefaultDictionaryAction()
  if (!action) {
    throw new Error("Dictionary definition missing")
  }

  const customAction = {
    ...action,
    id: "custom-save-action",
    name: "Custom Save Action",
    enabled,
  }

  return {
    config: {
      ...DEFAULT_CONFIG,
      selectionToolbar: {
        ...DEFAULT_CONFIG.selectionToolbar,
        customActions: [customAction],
        noteSuggestion: {
          ...DEFAULT_CONFIG.selectionToolbar.noteSuggestion,
          actionId: customAction.id,
        },
      },
    },
    customAction,
  }
}

describe("Note suggestion action config", () => {
  it("accepts the built-in Dictionary even when it is disabled", () => {
    const result = configSchema.safeParse({
      ...DEFAULT_CONFIG,
      selectionToolbar: {
        ...DEFAULT_CONFIG.selectionToolbar,
        builtInActions: {
          dictionary: {
            ...DEFAULT_CONFIG.selectionToolbar.builtInActions.dictionary,
            enabled: false,
          },
        },
      },
    })

    expect(result.success).toBe(true)
  })

  it("accepts an existing custom action regardless of its enabled state", () => {
    expect(configSchema.safeParse(createConfigWithCustomSaveAction(false).config).success).toBe(
      true,
    )
    expect(configSchema.safeParse(createConfigWithCustomSaveAction(true).config).success).toBe(true)
  })

  it("rejects a Note suggestion action id that does not exist", () => {
    const result = configSchema.safeParse({
      ...DEFAULT_CONFIG,
      selectionToolbar: {
        ...DEFAULT_CONFIG.selectionToolbar,
        noteSuggestion: {
          ...DEFAULT_CONFIG.selectionToolbar.noteSuggestion,
          actionId: "missing-action",
        },
      },
    })

    expect(result.success).toBe(false)
    if (result.success) {
      throw new Error("Expected a missing Note suggestion action to be rejected")
    }
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        message: 'Note suggestion action "missing-action" not found.',
        path: ["selectionToolbar", "noteSuggestion", "actionId"],
      }),
    )
  })
})
