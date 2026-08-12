import { describe, expect, it } from "vitest"
import { z } from "zod"
import { noteSuggestionEnvelopeSchema } from "../types"

describe("noteSuggestionEnvelopeSchema", () => {
  it("requires every property for OpenAI strict structured outputs", () => {
    const jsonSchema = z.toJSONSchema(noteSuggestionEnvelopeSchema)

    expect(jsonSchema.required).toEqual(["summaryFieldName", "notes"])
    expect(
      noteSuggestionEnvelopeSchema.safeParse({
        summaryFieldName: null,
        notes: [],
      }).success,
    ).toBe(true)
    expect(noteSuggestionEnvelopeSchema.safeParse({ notes: [] }).success).toBe(false)
  })
})
