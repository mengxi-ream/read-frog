import { describe, expect, it } from "vitest"
import { subtitleCustomPromptsConfigSchema } from "../subtitles"
import { pageCustomPromptsConfigSchema } from "../translate"

const customPrompt = {
  id: "my-custom-prompt",
  name: "My prompt",
  systemPrompt: "Translate carefully.",
  prompt: "{{input}}",
}

describe("built-in translation prompt config", () => {
  it.each(["default", "precision-rewrite"])("accepts page built-in %s", (promptId) => {
    expect(
      pageCustomPromptsConfigSchema.parse({
        promptId,
        patterns: [],
      }),
    ).toEqual({ promptId, patterns: [] })
  })

  it("accepts only default as a subtitle built-in", () => {
    expect(
      subtitleCustomPromptsConfigSchema.safeParse({ promptId: "default", patterns: [] }).success,
    ).toBe(true)
    expect(
      subtitleCustomPromptsConfigSchema.safeParse({
        promptId: "precision-rewrite",
        patterns: [],
      }).success,
    ).toBe(false)
  })

  it.each([pageCustomPromptsConfigSchema, subtitleCustomPromptsConfigSchema])(
    "normalizes the legacy null selection to default",
    (schema) => {
      expect(schema.parse({ promptId: null, patterns: [] })).toEqual({
        promptId: "default",
        patterns: [],
      })
    },
  )

  it.each([pageCustomPromptsConfigSchema, subtitleCustomPromptsConfigSchema])(
    "accepts and selects a custom prompt",
    (schema) => {
      expect(
        schema.safeParse({ promptId: customPrompt.id, patterns: [customPrompt] }).success,
      ).toBe(true)
    },
  )

  it("normalizes legacy page custom ids before background migration can run", () => {
    const parsed = pageCustomPromptsConfigSchema.parse({
      promptId: "precision-rewrite",
      patterns: [
        { ...customPrompt, id: "precision-rewrite-custom" },
        { ...customPrompt, id: "default" },
        { ...customPrompt, id: "precision-rewrite" },
        { ...customPrompt, id: "precision-rewrite" },
      ],
    })

    expect(parsed.promptId).toBe("precision-rewrite-custom-2")
    expect(parsed.patterns.map(({ id }) => id)).toEqual([
      "precision-rewrite-custom",
      "default-custom",
      "precision-rewrite-custom-2",
      "precision-rewrite-custom-3",
    ])
    expect(pageCustomPromptsConfigSchema.parse(parsed)).toEqual(parsed)
  })

  it("keeps a legacy null selection on the product default while renaming collisions", () => {
    expect(
      pageCustomPromptsConfigSchema.parse({
        promptId: null,
        patterns: [{ ...customPrompt, id: "precision-rewrite" }],
      }),
    ).toEqual({
      promptId: "default",
      patterns: [{ ...customPrompt, id: "precision-rewrite-custom" }],
    })
  })

  it("normalizes legacy subtitle default ids but leaves precision-rewrite custom", () => {
    const parsed = subtitleCustomPromptsConfigSchema.parse({
      promptId: "default",
      patterns: [
        { ...customPrompt, id: "default" },
        { ...customPrompt, id: "precision-rewrite" },
      ],
    })

    expect(parsed.promptId).toBe("default-custom")
    expect(parsed.patterns.map(({ id }) => id)).toEqual(["default-custom", "precision-rewrite"])
  })

  it.each([pageCustomPromptsConfigSchema, subtitleCustomPromptsConfigSchema])(
    "rejects an unknown selected prompt id",
    (schema) => {
      expect(schema.safeParse({ promptId: "missing", patterns: [customPrompt] }).success).toBe(
        false,
      )
    },
  )
})
