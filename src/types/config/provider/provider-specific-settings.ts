import type { LLMProviderTypes } from "./constants"

import { z } from "zod"

export interface ProviderSettingUiMeta {
  labelKey: string
  type: "text"
  placeholder?: string
}

declare module "zod" {
  interface GlobalMeta {
    providerSettingUi?: ProviderSettingUiMeta
  }
}

export interface ProviderSpecificSettingField extends ProviderSettingUiMeta {
  key: string
}

export type ProviderSpecificSettingsSchema = z.ZodObject<z.ZodRawShape>

export const bedrockProviderSpecificSettingsSchema = z.strictObject({
  region: z.string().trim().min(1).meta({
    providerSettingUi: {
      labelKey: "region",
      type: "text",
      placeholder: "us-east-1",
    },
  }),
})

export const PROVIDER_SPECIFIC_SETTINGS_SCHEMAS: Partial<Record<LLMProviderTypes, ProviderSpecificSettingsSchema>> = {
  bedrock: bedrockProviderSpecificSettingsSchema,
}

export function getProviderSpecificSettingFields(
  schema: ProviderSpecificSettingsSchema,
): ProviderSpecificSettingField[] {
  return Object.entries(schema.shape).map(([key, fieldSchema]) => {
    const ui = (fieldSchema as z.ZodType).meta()?.providerSettingUi

    if (!ui) {
      throw new Error(`providerSpecificSettings.${key} is missing providerSettingUi metadata`)
    }

    if (ui.type !== "text") {
      throw new Error(`Unsupported providerSpecificSettings.${key} field type: ${String(ui.type)}`)
    }

    return {
      key,
      labelKey: ui.labelKey,
      type: ui.type,
      placeholder: ui.placeholder,
    }
  })
}
