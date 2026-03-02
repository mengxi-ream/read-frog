import { describe, expect, it } from "vitest"
import { replaceSelectionToolbarCustomFeaturePromptTokens } from "../custom-feature-prompt"

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
