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

  it("instructs the model to pick a summary field explaining the first field's term", () => {
    const { systemPrompt } = buildSaveSuggestionPrompts(input)
    expect(systemPrompt).toContain('"summaryFieldName": string or null')
    expect(systemPrompt).toContain("explains the first field's term")
  })

  it("frames the language direction: user learns the selected text's language", () => {
    const { systemPrompt } = buildSaveSuggestionPrompts(input)
    expect(systemPrompt).toContain("learning the language the selected text is written in")
    expect(systemPrompt).toContain("transcribes the term in the term's own language")
    expect(systemPrompt).not.toContain("for a learner of the target language")
  })

  it("truncates oversized page text below the hosted prompt limit", () => {
    const { prompt } = buildSaveSuggestionPrompts({
      ...input,
      selection: "s".repeat(20_000),
      paragraphs: "p".repeat(40_000),
      webTitle: "t".repeat(5_000),
    })
    expect(prompt.length).toBeLessThan(16_000)
    expect(prompt).toContain("s".repeat(1_500))
    expect(prompt).not.toContain("s".repeat(1_501))
  })

  it("caps each candidate field description", () => {
    const { prompt } = buildSaveSuggestionPrompts({
      ...input,
      candidates: [
        createAction({
          outputSchema: [
            {
              id: "f1",
              name: "Term",
              type: "string",
              description: "d".repeat(2000),
              speaking: false,
            },
          ],
        }),
      ],
    })
    expect(prompt).toContain("d".repeat(300))
    expect(prompt).not.toContain("d".repeat(301))
  })

  it("drops candidate actions from the end to keep the prompt under budget", () => {
    // Many candidates, each with a long description, would blow the 32k limit.
    const many = Array.from({ length: 60 }, (_unusedA, i) =>
      createAction({
        id: `action-${i}`,
        name: `Action ${i}`,
        outputSchema: Array.from({ length: 8 }, (_unusedB, f) => ({
          id: `a${i}-f${f}`,
          name: `Field ${f}`,
          type: "string" as const,
          description: `desc ${i}-${f} ${"x".repeat(280)}`,
          speaking: false,
        })),
      }),
    )
    const { prompt } = buildSaveSuggestionPrompts({ ...input, candidates: many })

    // A valid request is always sent (under the 32000 hard limit, with headroom).
    expect(prompt.length).toBeLessThanOrEqual(30_000)
    // The first candidate survives; later ones are dropped to fit.
    expect(prompt).toContain('- id: "action-0"')
    expect(prompt).not.toContain('- id: "action-59"')
    // The default dictionary schema is always retained (createNew fallback).
    expect(prompt).toContain("Default Dictionary Schema")
  })
})
