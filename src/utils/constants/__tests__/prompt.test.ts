import { describe, expect, it } from "vitest"
import {
  BUILT_IN_PAGE_TRANSLATE_PROMPTS,
  BUILT_IN_SUBTITLE_TRANSLATE_PROMPTS,
  DEFAULT_SUBTITLE_TRANSLATE_PROMPTS_CONFIG,
  DEFAULT_TRANSLATE_PROMPTS_CONFIG,
  PRECISION_REWRITE_TRANSLATE_SYSTEM_PROMPT,
} from "../prompt"

describe("built-in translation prompts", () => {
  it("uses default as the real persisted selection on both surfaces", () => {
    expect(DEFAULT_TRANSLATE_PROMPTS_CONFIG).toEqual({ promptId: "default", patterns: [] })
    expect(DEFAULT_SUBTITLE_TRANSLATE_PROMPTS_CONFIG).toEqual({
      promptId: "default",
      patterns: [],
    })
  })

  it("registers only the intended built-ins per surface", () => {
    expect(Object.keys(BUILT_IN_PAGE_TRANSLATE_PROMPTS)).toEqual(["default", "precision-rewrite"])
    expect(Object.keys(BUILT_IN_SUBTITLE_TRANSLATE_PROMPTS)).toEqual(["default"])
  })

  it("keeps precision self-review silent and final-output-only", () => {
    expect(PRECISION_REWRITE_TRANSLATE_SYSTEM_PROMPT).toContain(
      "Perform these steps internally without revealing them",
    )
    expect(PRECISION_REWRITE_TRANSLATE_SYSTEM_PROMPT).toContain(
      "Never output analysis, reasoning, drafts, diagnoses, issue lists, or commentary",
    )
    expect(PRECISION_REWRITE_TRANSLATE_SYSTEM_PROMPT).not.toContain("List all issues")
    expect(PRECISION_REWRITE_TRANSLATE_SYSTEM_PROMPT).not.toContain("brief clarification")
  })
})
