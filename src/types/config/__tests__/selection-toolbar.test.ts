import { describe, expect, it } from "vitest"
import {
  MAX_CUSTOM_ACTION_LAYOUT_LENGTH,
  selectionToolbarCustomActionsSchema,
} from "../selection-toolbar"

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
    },
  ],
}

describe("selectionToolbarCustomActionsSchema", () => {
  it.each(["default-dictionary", "default-sentence-analysis"])(
    "rejects the built-in id %s in custom actions",
    (id) => {
      const result = selectionToolbarCustomActionsSchema.safeParse([{ ...customAction, id }])

      expect(result.success).toBe(false)
      if (result.success) {
        throw new Error("Expected the reserved action id to be rejected")
      }

      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          message: `Action id "${id}" is reserved for a built-in action.`,
          path: [0, "id"],
        }),
      )
    },
  )

  it("accepts ordinary custom action ids", () => {
    expect(selectionToolbarCustomActionsSchema.safeParse([customAction]).success).toBe(true)
  })

  it("accepts an action with a layout, without one, and with a blank one", () => {
    for (const layout of ["<p>{{ Result }}</p>", "", undefined]) {
      const result = selectionToolbarCustomActionsSchema.safeParse([{ ...customAction, layout }])
      expect(result.success).toBe(true)
      expect(result.data?.[0]?.layout).toBe(layout)
    }
  })

  it("does not syntax-check the layout, so a broken template cannot fail the config", () => {
    const layout = "{% if %}{{ unclosed"
    expect(
      selectionToolbarCustomActionsSchema.safeParse([{ ...customAction, layout }]).success,
    ).toBe(true)
  })

  it("caps the layout length", () => {
    const atCap = "x".repeat(MAX_CUSTOM_ACTION_LAYOUT_LENGTH)
    expect(
      selectionToolbarCustomActionsSchema.safeParse([{ ...customAction, layout: atCap }]).success,
    ).toBe(true)

    const result = selectionToolbarCustomActionsSchema.safeParse([
      { ...customAction, layout: `${atCap}x` },
    ])
    expect(result.success).toBe(false)
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ code: "too_big", path: [0, "layout"] }),
    )
  })

  it("rejects a non-string layout", () => {
    expect(
      selectionToolbarCustomActionsSchema.safeParse([{ ...customAction, layout: null }]).success,
    ).toBe(false)
  })
})
