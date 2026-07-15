import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { describe, expect, it } from "vitest"
import { buildSaveSuggestionPrompts } from "../prompt"

function createAction(
  overrides: Partial<SelectionToolbarCustomAction> = {},
): SelectionToolbarCustomAction {
  return {
    id: "action-1",
    name: "My Dictionary",
    enabled: true,
    icon: "tabler:book-2",
    providerId: "read-frog-free-ai",
    systemPrompt: "system",
    prompt: "prompt",
    outputSchema: [
      {
        id: "field-term",
        name: "Term",
        type: "string",
        description: "Base form in {{targetLanguage}}",
        speaking: true,
      },
      { id: "field-level", name: "Level", type: "number", description: "", speaking: false },
    ],
    ...overrides,
  }
}

describe("buildSaveSuggestionPrompts", () => {
  const input = {
    selection: "ephemeral beauty",
    paragraphs: "The ephemeral beauty of cherry blossoms.",
    targetLanguage: "Simplified Chinese",
    webTitle: "Sakura Season",
    candidates: [createAction()],
    dictionaryDraft: createAction({
      id: "draft-1",
      name: "Dictionary",
      outputSchema: [
        { id: "d-term", name: "词条", type: "string", description: "", speaking: true },
      ],
    }),
  }

  it("includes selection, paragraphs, target language, and web title", () => {
    const { prompt } = buildSaveSuggestionPrompts(input)
    expect(prompt).toContain("ephemeral beauty")
    expect(prompt).toContain("The ephemeral beauty of cherry blossoms.")
    expect(prompt).toContain("Simplified Chinese")
    expect(prompt).toContain("Sakura Season")
  })

  it("lists candidate actions with ids, names, field keys, and types", () => {
    const { prompt } = buildSaveSuggestionPrompts(input)
    expect(prompt).toContain('- id: "action-1"')
    expect(prompt).toContain('name: "My Dictionary"')
    expect(prompt).toContain('- key: "Term"')
    expect(prompt).toContain("type: string")
    expect(prompt).toContain("type: number")
  })

  it("resolves prompt tokens inside field descriptions", () => {
    const { prompt } = buildSaveSuggestionPrompts(input)
    expect(prompt).toContain("Base form in Simplified Chinese")
    expect(prompt).not.toContain("{{targetLanguage}}")
  })

  it("lists the dictionary draft schema and falls back to None. without candidates", () => {
    const { prompt } = buildSaveSuggestionPrompts({ ...input, candidates: [] })
    expect(prompt).toContain("Candidate Actions\nNone.")
    expect(prompt).toContain('- key: "词条"')
  })

  it("pins the envelope contract in the system prompt", () => {
    const { systemPrompt } = buildSaveSuggestionPrompts(input)
    expect(systemPrompt).toContain("createNewDictionaryAction")
    expect(systemPrompt).toContain("targetActionId")
    expect(systemPrompt).toContain("Return 1 or 2 notes")
    expect(systemPrompt).toContain("valid JSON only")
  })
})
