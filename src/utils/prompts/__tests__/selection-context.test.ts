import type { Config } from "@/types/config/config"
import { describe, expect, it } from "vitest"
import { DEFAULT_TRANSLATE_PROMPT_ID } from "@/utils/constants/prompt"
import {
  appendSelectionContextToSystemPrompt,
  renderSelectionContextPromptBlock,
  SELECTION_CONTEXT_CHAR_LIMIT,
  SELECTION_CONTEXT_SYSTEM_PROMPT_RULES,
  toSelectionPromptContext,
} from "../selection-context"
import { getTranslatePromptFromConfig } from "../translate"

const translateConfig: Pick<Config["pageTranslation"], "customPromptsConfig"> = {
  customPromptsConfig: { promptId: DEFAULT_TRANSLATE_PROMPT_ID, patterns: [] },
}

describe("toSelectionPromptContext", () => {
  it("joins the paragraphs around the selection", () => {
    expect(toSelectionPromptContext([" First. ", "", "Second."])).toEqual({
      passage: "First.\n\nSecond.",
    })
  })

  it("gives nothing when there is no text to give", () => {
    expect(toSelectionPromptContext(undefined)).toBeUndefined()
    expect(toSelectionPromptContext([])).toBeUndefined()
    expect(toSelectionPromptContext(["", "  "])).toBeUndefined()
  })

  it("cuts the passage to the custom actions' limit", () => {
    const context = toSelectionPromptContext(["x".repeat(SELECTION_CONTEXT_CHAR_LIMIT + 50)])

    expect(context?.passage).toHaveLength(SELECTION_CONTEXT_CHAR_LIMIT)
  })
})

describe("appendSelectionContextToSystemPrompt", () => {
  it("returns the prompt byte-identical without a passage", () => {
    expect(appendSelectionContextToSystemPrompt("System.", undefined)).toBe("System.")
    expect(appendSelectionContextToSystemPrompt("System.", { passage: "  " })).toBe("System.")
    expect(renderSelectionContextPromptBlock(undefined)).toBeNull()
  })

  it("appends the rules and the passage after a blank line", () => {
    expect(appendSelectionContextToSystemPrompt("System.", { passage: "The cat sat." })).toBe(
      `System.\n\n${SELECTION_CONTEXT_SYSTEM_PROMPT_RULES}\n\nPassage:\nThe cat sat.`,
    )
  })

  it("does not let a passage rewrite the prompt's tokens", () => {
    const { systemPrompt, prompt } = getTranslatePromptFromConfig(
      translateConfig,
      "Chinese",
      "cat",
      { selectionContext: { passage: "A {{input}} sat on the {{targetLanguage}} mat." } },
    )

    expect(systemPrompt).toContain("Passage:\nA {{input}} sat on the {{targetLanguage}} mat.")
    expect(prompt).not.toContain("Passage")
  })

  it("leaves a prompt built without a passage unchanged", () => {
    const without = getTranslatePromptFromConfig(translateConfig, "Chinese", "cat")
    const withEmpty = getTranslatePromptFromConfig(translateConfig, "Chinese", "cat", {
      selectionContext: undefined,
    })

    expect(withEmpty).toEqual(without)
  })
})
