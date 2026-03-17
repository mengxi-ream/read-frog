import { describe, expect, it } from "vitest"
import { buildSelectionToolbarCustomActionSystemPrompt, replaceSelectionToolbarCustomActionPromptTokens } from "../custom-action-prompt"

describe("replaceSelectionToolbarCustomActionPromptTokens", () => {
  const baseTokens = {
    selection: "hello",
    paragraphs: "hello world paragraph",
    targetLanguage: "English",
    webTitle: "Test Page",
  }

  it("replaces selection and paragraphs tokens", () => {
    const result = replaceSelectionToolbarCustomActionPromptTokens(
      "selection={{selection}}, paragraphs={{paragraphs}}",
      baseTokens,
    )

    expect(result).toBe("selection=hello, paragraphs=hello world paragraph")
  })

  it("replaces targetLanguage and webTitle tokens", () => {
    const result = replaceSelectionToolbarCustomActionPromptTokens(
      "Target language: {{targetLanguage}}, Page: {{webTitle}}",
      baseTokens,
    )

    expect(result).toBe("Target language: English, Page: Test Page")
  })

  it("leaves unrelated text unchanged", () => {
    const result = replaceSelectionToolbarCustomActionPromptTokens(
      "plain text",
      baseTokens,
    )

    expect(result).toBe("plain text")
  })
})

describe("buildSelectionToolbarCustomActionSystemPrompt", () => {
  const baseTokens = {
    selection: "hello",
    paragraphs: "hello world paragraph",
    targetLanguage: "English",
    webTitle: "Test Page",
  }

  it("appends structured output contract with resolved fields and defaults", () => {
    const result = buildSelectionToolbarCustomActionSystemPrompt(
      "system={{paragraphs}}",
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
    const result = buildSelectionToolbarCustomActionSystemPrompt(
      "system={{paragraphs}}",
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
    const result = buildSelectionToolbarCustomActionSystemPrompt(
      "system={{paragraphs}}",
      baseTokens,
      [
        {
          name: "{{webTitle}}",
          type: "string",
          description: "Explain in {{targetLanguage}} based on {{paragraphs}}",
        },
      ],
    )

    expect(result).toContain("- key: \"{{webTitle}}\"")
    expect(result).toContain("    Explain in English based on hello world paragraph")
  })

  it("preserves multiline field description in yaml block", () => {
    const result = buildSelectionToolbarCustomActionSystemPrompt(
      "system={{paragraphs}}",
      baseTokens,
      [
        {
          name: "Notes",
          type: "string",
          description: "First line\nSecond line in {{targetLanguage}}",
        },
      ],
    )

    expect(result).toContain("  description: |-")
    expect(result).toContain("    First line")
    expect(result).toContain("    Second line in English")
  })

  it("returns contract when prompt content is empty", () => {
    const result = buildSelectionToolbarCustomActionSystemPrompt(
      "   ",
      baseTokens,
      [{ name: "Definition", type: "string", description: "" }],
    )

    expect(result).toContain("## Structured Output Contract")
    expect(result).not.toContain("system=")
  })
})
