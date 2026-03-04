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
        { name: "Definition", type: "string" },
        { name: "Score", type: "number" },
      ],
    )

    expect(result).toContain("system=hello world paragraph")
    expect(result).toContain("## Structured Output Contract")
    expect(result).toContain("\"Definition\": string (nullable)")
    expect(result).toContain("\"Score\": number (nullable)")
    expect(result).toContain("\"Definition\": null")
    expect(result).toContain("\"Score\": null")
  })

  it("returns contract when prompt content is empty", () => {
    const result = buildSelectionToolbarCustomFeatureSystemPrompt(
      "   ",
      baseTokens,
      [{ name: "Definition", type: "string" }],
    )

    expect(result).toContain("## Structured Output Contract")
    expect(result).not.toContain("system=")
  })
})
