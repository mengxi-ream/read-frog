import { describe, expect, it } from "vitest"
import { buildSelectionToolbarCustomFeatureSystemPrompt, replaceSelectionToolbarCustomFeaturePromptTokens } from "../custom-feature-prompt"

describe("replaceSelectionToolbarCustomFeaturePromptTokens", () => {
  const baseTokens = {
    selection: "hello",
    context: "hello world paragraph",
    targetLang: "English",
    title: "Test Page",
  }

  it("replaces selection and context tokens", () => {
    const result = replaceSelectionToolbarCustomFeaturePromptTokens(
      "selection={{selection}}, context={{context}}",
      baseTokens,
    )

    expect(result).toBe("selection=hello, context=hello world paragraph")
  })

  it("replaces targetLang and title tokens", () => {
    const result = replaceSelectionToolbarCustomFeaturePromptTokens(
      "Target language: {{targetLang}}, Page: {{title}}",
      baseTokens,
    )

    expect(result).toBe("Target language: English, Page: Test Page")
  })

  it("leaves unrelated text unchanged", () => {
    const result = replaceSelectionToolbarCustomFeaturePromptTokens(
      "plain text",
      baseTokens,
    )

    expect(result).toBe("plain text")
  })
})

describe("buildSelectionToolbarCustomFeatureSystemPrompt", () => {
  const baseTokens = {
    selection: "hello",
    context: "hello world paragraph",
    targetLang: "English",
    title: "Test Page",
  }

  it("appends structured output contract with resolved fields and defaults", () => {
    const result = buildSelectionToolbarCustomFeatureSystemPrompt(
      "system={{context}}",
      baseTokens,
      [
        { name: "Definition", type: "string", description: "" },
        { name: "Score", type: "number", description: "" },
      ],
    )

    expect(result).toContain("system=hello world paragraph")
    expect(result).toContain("## Structured Output Contract")
    expect(result).toContain("- key: \"Definition\"")
    expect(result).toContain("  type: string")
    expect(result).toContain("- key: \"Score\"")
    expect(result).toContain("  type: number")
    expect(result).toContain("  nullable: true")
    expect(result).toContain("  description: \"\"")
  })

  it("includes description in contract when provided", () => {
    const result = buildSelectionToolbarCustomFeatureSystemPrompt(
      "system={{context}}",
      baseTokens,
      [
        { name: "Term", type: "string", description: "Base/canonical lemma" },
        { name: "Score", type: "number", description: "" },
      ],
    )

    expect(result).toContain("- key: \"Term\"")
    expect(result).toContain("  description: |-")
    expect(result).toContain("    Base/canonical lemma")
    expect(result).toContain("- key: \"Score\"")
    expect(result).not.toContain("  description: |-\n    \n")
  })

  it("resolves tokens in field description but keeps key names unchanged", () => {
    const result = buildSelectionToolbarCustomFeatureSystemPrompt(
      "system={{context}}",
      baseTokens,
      [
        {
          name: "{{title}}",
          type: "string",
          description: "Explain in {{targetLang}} based on {{context}}",
        },
      ],
    )

    expect(result).toContain("- key: \"{{title}}\"")
    expect(result).toContain("    Explain in English based on hello world paragraph")
  })

  it("preserves multiline field description in yaml block", () => {
    const result = buildSelectionToolbarCustomFeatureSystemPrompt(
      "system={{context}}",
      baseTokens,
      [
        {
          name: "Notes",
          type: "string",
          description: "First line\nSecond line in {{targetLang}}",
        },
      ],
    )

    expect(result).toContain("  description: |-")
    expect(result).toContain("    First line")
    expect(result).toContain("    Second line in English")
  })

  it("returns contract when prompt content is empty", () => {
    const result = buildSelectionToolbarCustomFeatureSystemPrompt(
      "   ",
      baseTokens,
      [{ name: "Definition", type: "string", description: "" }],
    )

    expect(result).toContain("## Structured Output Contract")
    expect(result).not.toContain("system=")
  })
})
