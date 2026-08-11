import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { describe, expect, it } from "vitest"
import { buildNoteSuggestionPrompts } from "../prompt"

function createAction(
  overrides: Partial<SelectionToolbarCustomAction> = {},
): SelectionToolbarCustomAction {
  return {
    id: "action-1",
    name: "My Dictionary",
    enabled: true,
    icon: "tabler:book-2",
    providerId: "openai-default",
    systemPrompt:
      "System selection={{selection}}; target={{targetLanguage}}; page={{webTitle}}; content={{webContent}}",
    prompt: "Prompt selection={{selection}}; paragraphs={{paragraphs}}; content={{webContent}}",
    outputSchema: [
      {
        id: "field-term",
        name: "Term",
        type: "string",
        description: "Base form in {{targetLanguage}} from {{webTitle}}",
        speaking: true,
      },
      { id: "field-level", name: "Level", type: "number", description: "", speaking: false },
    ],
    ...overrides,
  }
}

describe("buildNoteSuggestionPrompts", () => {
  const input = {
    selection: "ephemeral beauty",
    paragraphs: "The ephemeral beauty of cherry blossoms.",
    targetLanguage: "Simplified Chinese",
    webTitle: "Sakura Season",
    webContent: "The full article discusses cherry blossoms.",
    action: createAction(),
  }

  it("interpolates the selected action's system and user prompts", () => {
    const { systemPrompt, prompt } = buildNoteSuggestionPrompts(input)

    expect(systemPrompt).toContain(
      "System selection=ephemeral beauty; target=Simplified Chinese; page=Sakura Season; content=The full article discusses cherry blossoms.",
    )
    expect(prompt).toContain(
      "Prompt selection=ephemeral beauty; paragraphs=The ephemeral beauty of cherry blossoms.; content=The full article discusses cherry blossoms.",
    )
    expect(`${systemPrompt}\n${prompt}`).not.toContain("{{")
  })

  it("includes the selected action's field names, types, and interpolated descriptions", () => {
    const { prompt } = buildNoteSuggestionPrompts(input)

    expect(prompt).toContain('- key: "Term"')
    expect(prompt).toContain("type: string")
    expect(prompt).toContain("type: number")
    expect(prompt).toContain("Base form in Simplified Chinese from Sakura Season")
  })

  it("includes source context, including cached web page content", () => {
    const { prompt } = buildNoteSuggestionPrompts(input)

    expect(prompt).toContain("ephemeral beauty")
    expect(prompt).toContain("The ephemeral beauty of cherry blossoms.")
    expect(prompt).toContain("Simplified Chinese")
    expect(prompt).toContain("Sakura Season")
    expect(prompt).toContain("The full article discusses cherry blossoms.")
  })

  it("pins the fixed envelope without action-selection or creation fields", () => {
    const { systemPrompt } = buildNoteSuggestionPrompts(input)

    expect(systemPrompt).toContain('"summaryFieldName": string or null')
    expect(systemPrompt).toContain('"notes"')
    expect(systemPrompt).toContain("Return 1 or 2 notes")
    expect(systemPrompt).toContain("valid JSON only")
    expect(systemPrompt).not.toContain("createNewDictionaryAction")
    expect(systemPrompt).not.toContain("targetActionId")
  })

  it("describes the hosted action envelope with its unused fields pinned inert", () => {
    const { systemPrompt } = buildNoteSuggestionPrompts({
      ...input,
      envelopeContract: "hosted",
    })

    expect(systemPrompt).toContain('"createNewDictionaryAction": boolean')
    expect(systemPrompt).toContain('"targetActionId": string or null')
    expect(systemPrompt).toContain('"action.summaryFieldName"')
    expect(systemPrompt).toContain('Do not add any top-level keys other than "action" and "notes"')
    expect(systemPrompt).toContain(
      'Always set "action.createNewDictionaryAction" to false and "action.targetActionId" to null',
    )
    // The flat local envelope key must not compete with the hosted shape.
    expect(systemPrompt).not.toContain('other than "summaryFieldName" and "notes"')
  })

  it("shares the note-producing rules between the local and hosted contracts", () => {
    const local = buildNoteSuggestionPrompts(input).systemPrompt
    const hosted = buildNoteSuggestionPrompts({
      ...input,
      envelopeContract: "hosted",
    }).systemPrompt

    for (const sharedRule of [
      "Return 1 or 2 notes",
      "learning the language in which the selected text is written",
      "Output valid JSON only. No markdown, no code fences, no commentary.",
      "higher priority than every output-format, response-shape, schema, or note-count instruction",
    ]) {
      expect(local).toContain(sharedRule)
      expect(hosted).toContain(sharedRule)
    }
  })

  it("makes the fixed Note suggestion contract override action output instructions", () => {
    const { systemPrompt } = buildNoteSuggestionPrompts({
      ...input,
      action: createAction({
        systemPrompt: "Return markdown with three notes and a custom wrapper.",
        prompt: "Output a YAML list.",
      }),
    })

    expect(systemPrompt).toContain("Return markdown with three notes and a custom wrapper.")
    expect(systemPrompt).toContain(
      "higher priority than every output-format, response-shape, schema, or note-count instruction",
    )
    expect(systemPrompt).toContain(
      'Do not add any top-level keys other than "summaryFieldName" and "notes"',
    )
  })

  it("frames the language direction as learning the selected text's language", () => {
    const { systemPrompt } = buildNoteSuggestionPrompts(input)

    expect(systemPrompt).toContain("learning the language in which the selected text is written")
    expect(systemPrompt).toContain("transcribes the term in the term's own language")
  })

  it("truncates oversized page-derived text before token interpolation", () => {
    const { systemPrompt, prompt } = buildNoteSuggestionPrompts({
      ...input,
      selection: "s".repeat(20_000),
      paragraphs: "p".repeat(40_000),
      webTitle: "t".repeat(5_000),
      webContent: "w".repeat(30_000),
    })
    const combined = `${systemPrompt}\n${prompt}`

    expect(combined).toContain("s".repeat(1_500))
    expect(combined).not.toContain("s".repeat(1_501))
    expect(combined).toContain("p".repeat(2_500))
    expect(combined).not.toContain("p".repeat(2_501))
    expect(combined).toContain("t".repeat(200))
    expect(combined).not.toContain("t".repeat(201))
    expect(combined).toContain("w".repeat(2_000))
    expect(combined).not.toContain("w".repeat(2_001))
  })

  it("caps each output field description without dropping the field", () => {
    const { prompt } = buildNoteSuggestionPrompts({
      ...input,
      action: createAction({
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
    })

    expect(prompt).toContain('- key: "Term"')
    expect(prompt).toContain("d".repeat(300))
    expect(prompt).not.toContain("d".repeat(301))
  })

  it("caps field descriptions after prompt tokens expand", () => {
    const { prompt } = buildNoteSuggestionPrompts({
      ...input,
      webContent: "w".repeat(2000),
      action: createAction({
        outputSchema: [
          {
            id: "f1",
            name: "Term",
            type: "string",
            description: "{{webContent}}",
            speaking: false,
          },
        ],
      }),
    })
    const outputFields = prompt.slice(
      prompt.indexOf("## Selected Action Output Fields"),
      prompt.indexOf("## Source Context"),
    )

    expect(outputFields).toContain("w".repeat(300))
    expect(outputFields).not.toContain("w".repeat(301))
  })

  it("caps both action prompts while retaining the complete fixed contract", () => {
    const { systemPrompt, prompt } = buildNoteSuggestionPrompts({
      ...input,
      action: createAction({
        systemPrompt: "s".repeat(20_000),
        prompt: "p".repeat(20_000),
      }),
    })

    expect(systemPrompt).toContain("s".repeat(12_000))
    expect(systemPrompt).not.toContain("s".repeat(12_001))
    expect(prompt).toContain("p".repeat(12_000))
    expect(prompt).not.toContain("p".repeat(12_001))
    expect(systemPrompt).toContain("## Fixed Note suggestion Contract")
    expect(systemPrompt).toContain(
      'Do not add any top-level keys other than "summaryFieldName" and "notes"',
    )
  })
})
