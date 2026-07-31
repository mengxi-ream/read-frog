import type { CustomLLMProviderTypes } from "../provider"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  azureProviderSpecificSettingsSchema,
  bedrockProviderSpecificSettingsSchema,
  customProviderSpecificSettingsSchema,
  CUSTOM_LLM_PROVIDER_TYPES,
  getProviderSpecificSettingFields,
  LLM_PROVIDER_MODELS,
  providerConfigItemSchema,
} from "../provider"

function createCustomProviderConfig(provider: CustomLLMProviderTypes) {
  return {
    id: `${provider}-default`,
    name: provider,
    enabled: true,
    provider,
    baseURL: "https://api.example.com/v1",
    model: {
      model: LLM_PROVIDER_MODELS[provider][0],
      isCustomModel: provider === "openai-compatible",
      customModel: null,
    },
  }
}

describe("provider-specific settings metadata", () => {
  it("returns the Bedrock region field from Zod metadata", () => {
    expect(getProviderSpecificSettingFields(bedrockProviderSpecificSettingsSchema)).toEqual([
      {
        key: "region",
        labelKey: "region",
        type: "text",
        placeholder: "us-east-1",
      },
    ])
  })

  it("returns the Azure resource fields from Zod metadata", () => {
    expect(getProviderSpecificSettingFields(azureProviderSpecificSettingsSchema)).toEqual([
      {
        key: "apiMode",
        labelKey: "apiMode",
        type: "select",
        defaultValue: "responses",
        options: [
          { value: "responses", labelKey: "responses" },
          { value: "chat", labelKey: "chatCompletions" },
        ],
      },
      {
        key: "resourceName",
        labelKey: "resourceName",
        type: "text",
        placeholder: "my-azure-openai-resource",
      },
      {
        key: "apiVersion",
        labelKey: "apiVersion",
        type: "text",
        placeholder: "v1",
      },
    ])
  })

  it("returns the Custom Provider API mode field from Zod metadata", () => {
    expect(getProviderSpecificSettingFields(customProviderSpecificSettingsSchema)).toEqual([
      {
        key: "apiMode",
        labelKey: "apiMode",
        type: "select",
        defaultValue: "chat",
        options: [
          { value: "responses", labelKey: "responses" },
          { value: "chat", labelKey: "chatCompletions" },
        ],
      },
    ])
  })

  it("throws when a provider-specific setting lacks providerSettingUi metadata", () => {
    const schema = z.strictObject({
      region: z.string(),
    })

    expect(() => getProviderSpecificSettingFields(schema)).toThrow(
      "providerSpecificSettings.region is missing providerSettingUi metadata",
    )
  })

  it("throws when a provider-specific setting uses an unsupported field type", () => {
    const schema = z.strictObject({
      region: z.string().meta({
        providerSettingUi: {
          labelKey: "region",
          type: "password" as any,
        },
      }),
    })

    expect(() => getProviderSpecificSettingFields(schema)).toThrow(
      "Unsupported providerSpecificSettings.region field type: password",
    )
  })
})

describe("Custom Provider config schema", () => {
  it("accepts Responses API mode", () => {
    const result = providerConfigItemSchema.safeParse({
      ...createCustomProviderConfig("openai-compatible"),
      providerSpecificSettings: {
        apiMode: "responses",
      },
    })

    expect(result.success).toBe(true)
  })

  it("accepts an existing config without provider-specific settings", () => {
    const result = providerConfigItemSchema.safeParse(
      createCustomProviderConfig("openai-compatible"),
    )

    expect(result.success).toBe(true)
  })

  it.each(CUSTOM_LLM_PROVIDER_TYPES.filter((provider) => provider !== "openai-compatible"))(
    "rejects provider-specific settings for %s",
    (provider) => {
      const result = providerConfigItemSchema.safeParse({
        ...createCustomProviderConfig(provider),
        providerSpecificSettings: {
          apiMode: "responses",
        },
      })

      expect(result.success).toBe(false)
    },
  )
})
