import { describe, expect, it } from "vitest"
import { apiProviderConfigItemSchema, llmProviderModelsSchema } from "../schemas"

const dynamicGoogleModel = {
  model: "gemini-future-text",
  isCustomModel: false,
  customModel: null,
}

describe("Google provider model schemas", () => {
  it("accepts model ids discovered from the Google API", () => {
    expect(
      apiProviderConfigItemSchema.parse({
        id: "google-provider",
        name: "Google",
        enabled: true,
        provider: "google",
        model: dynamicGoogleModel,
      }),
    ).toEqual(expect.objectContaining({ model: dynamicGoogleModel }))

    expect(llmProviderModelsSchema.shape.google.parse(dynamicGoogleModel)).toEqual(
      dynamicGoogleModel,
    )
  })

  it("keeps enum validation for providers with static model lists", () => {
    expect(() => llmProviderModelsSchema.shape.openai.parse(dynamicGoogleModel)).toThrow(
      /Invalid option/,
    )
  })
})
