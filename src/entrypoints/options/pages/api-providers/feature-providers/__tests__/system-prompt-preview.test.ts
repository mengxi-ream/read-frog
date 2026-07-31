import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { describe, expect, it } from "vitest"
import { toSystemPromptPreview } from ".."

function makeAction(
  overrides: Partial<SelectionToolbarCustomAction>,
): SelectionToolbarCustomAction {
  return {
    id: "action",
    name: "Action",
    icon: "tabler:sparkles",
    providerId: "provider",
    systemPrompt: "",
    prompt: "",
    outputSchema: [],
    ...overrides,
  }
}

describe("toSystemPromptPreview", () => {
  it("returns a short system prompt untouched", () => {
    const preview = toSystemPromptPreview(makeAction({ systemPrompt: "You are a dictionary." }))

    expect(preview).toBe("You are a dictionary.")
  })

  it("collapses the newlines and headings a multi-line prompt starts with", () => {
    const preview = toSystemPromptPreview(
      makeAction({ systemPrompt: "You are helpful.\n\n## Goal\nBe concise." }),
    )

    expect(preview).toBe("You are helpful. ## Goal Be concise.")
  })

  it("cuts a long prompt to a fixed length and marks it with an ellipsis", () => {
    const preview = toSystemPromptPreview(makeAction({ systemPrompt: "a".repeat(200) }))

    // 80 characters of prompt, then the ellipsis that shows it was cut.
    expect(preview).toBe(`${"a".repeat(80)}…`)
  })

  it("does not leave a dangling space in front of the ellipsis", () => {
    const preview = toSystemPromptPreview(makeAction({ systemPrompt: "word ".repeat(100) }))

    expect(preview.endsWith("d…")).toBe(true)
  })

  it("falls back to the user prompt when no system prompt is set", () => {
    const preview = toSystemPromptPreview(
      makeAction({ systemPrompt: "  ", prompt: "Explain {{selection}}." }),
    )

    expect(preview).toBe("Explain {{selection}}.")
  })
})
