import { describe, expect, it, vi } from "vitest"
import {
  DEFAULT_TRANSLATE_PROMPT_ID,
  PRECISION_REWRITE_TRANSLATE_PROMPT_ID,
} from "@/utils/constants/prompt"
import {
  getBuiltInPageTranslatePrompts,
  getBuiltInSubtitleTranslatePrompts,
  getPageTranslatePromptSelectItems,
} from "../built-in-prompts"

vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string) =>
      ({
        "options.translation.personalizedPrompts.default": "Default",
        "options.translation.personalizedPrompts.builtInPrompts.precisionRewrite.name":
          "Deep polish",
        "options.translation.personalizedPrompts.builtInPrompts.default.description":
          "Default description",
        "options.translation.personalizedPrompts.builtInPrompts.precisionRewrite.description":
          "Precision description",
      })[key] ?? key,
  },
}))

describe("built-in translation prompt presentation", () => {
  it("orders page built-ins before custom prompts", () => {
    const items = getPageTranslatePromptSelectItems([
      { id: "custom", name: "Custom", systemPrompt: "System", prompt: "Prompt" },
    ])

    expect(items.map(({ value }) => value)).toEqual([
      DEFAULT_TRANSLATE_PROMPT_ID,
      PRECISION_REWRITE_TRANSLATE_PROMPT_ID,
      "custom",
    ])
    expect(items.map(({ label }) => label)).toEqual(["Default", "Deep polish", "Custom"])
  })

  it("offers precision rewrite only for page translation", () => {
    expect(getBuiltInPageTranslatePrompts().map(({ id }) => id)).toEqual([
      DEFAULT_TRANSLATE_PROMPT_ID,
      PRECISION_REWRITE_TRANSLATE_PROMPT_ID,
    ])
    expect(getBuiltInSubtitleTranslatePrompts().map(({ id }) => id)).toEqual([
      DEFAULT_TRANSLATE_PROMPT_ID,
    ])
  })
})
