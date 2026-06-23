import { describe, expect, it } from "vitest"
import { z } from "zod"
import { azureProviderSpecificSettingsSchema, bedrockProviderSpecificSettingsSchema, getProviderSpecificSettingFields } from "../provider"

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
