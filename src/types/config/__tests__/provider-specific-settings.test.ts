import { describe, expect, it } from "vitest"
import { z } from "zod"
import { bedrockProviderSpecificSettingsSchema, getProviderSpecificSettingFields } from "../provider"

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
