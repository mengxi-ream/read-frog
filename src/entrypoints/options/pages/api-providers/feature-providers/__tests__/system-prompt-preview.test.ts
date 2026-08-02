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

  it("cuts a long prompt to a fixed word count and marks it with an ellipsis", () => {
    const preview = toSystemPromptPreview(makeAction({ systemPrompt: "word ".repeat(100) }))

    expect(preview).toBe(`${"word ".repeat(8).trimEnd()}…`)
  })

  it("gives a Chinese prompt a preview of the same word count, not the same length", () => {
    // 你好 and 世界 are a word each, so 8 words is 4 of these sentences — 19 characters, where
    // the character budget this replaced would have run to 160 and carried far more content.
    const preview = toSystemPromptPreview(makeAction({ systemPrompt: "你好世界。".repeat(40) }))

    expect(preview).toBe(`${"你好世界。".repeat(3)}你好世界…`)
  })

  it("falls back to a character cut for text the segmenter finds no word breaks in", () => {
    const preview = toSystemPromptPreview(makeAction({ systemPrompt: "a".repeat(400) }))

    expect(preview).toBe(`${"a".repeat(160)}…`)
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
