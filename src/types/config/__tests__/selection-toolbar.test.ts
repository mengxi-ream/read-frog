import { describe, expect, it } from "vitest"
import { selectionToolbarCustomActionsSchema } from "../selection-toolbar"

const customAction = {
  id: "custom-action",
  name: "Custom Action",
  enabled: true,
  icon: "tabler:sparkles",
  providerId: "read-frog-free-ai",
  systemPrompt: "",
  prompt: "{{selection}}",
  outputSchema: [
    {
      id: "result",
      name: "Result",
      type: "string" as const,
      description: "",
      speaking: false,
    },
  ],
}

describe("selectionToolbarCustomActionsSchema", () => {
  it("rejects the built-in Dictionary id in custom actions", () => {
    const result = selectionToolbarCustomActionsSchema.safeParse([
      {
        ...customAction,
        id: "default-dictionary",
      },
    ])

    expect(result.success).toBe(false)
    if (result.success) {
      throw new Error("Expected the reserved action id to be rejected")
    }

    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        message: 'Action id "default-dictionary" is reserved for the built-in Dictionary.',
        path: [0, "id"],
      }),
    )
  })

  it("accepts ordinary custom action ids", () => {
    expect(selectionToolbarCustomActionsSchema.safeParse([customAction]).success).toBe(true)
  })
})
