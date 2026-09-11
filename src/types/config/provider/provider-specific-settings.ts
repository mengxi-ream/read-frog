import type { LLMProviderTypes } from "./constants"
import { z } from "zod"

export const AZURE_API_MODES = ["responses", "chat"] as const
export type AzureApiMode = (typeof AZURE_API_MODES)[number]
export const DEFAULT_AZURE_API_MODE: AzureApiMode = "responses"

interface ProviderSettingBaseUiMeta {
  labelKey: string
  placeholder?: string
  hintKey?: string
}

interface ProviderSettingTextUiMeta extends ProviderSettingBaseUiMeta {
  type: "text"
}

interface ProviderSettingSelectUiMeta extends ProviderSettingBaseUiMeta {
  type: "select"
  defaultValue?: string
  options: Array<{
    value: string
    labelKey: string
  }>
}

export type ProviderSettingUiMeta = ProviderSettingTextUiMeta | ProviderSettingSelectUiMeta

declare module "zod" {
  interface GlobalMeta {
    providerSettingUi?: ProviderSettingUiMeta
  }
}

export type ProviderSpecificSettingField = ProviderSettingUiMeta & {
  key: string
}

export type ProviderSpecificSettingsSchema = z.ZodObject<z.ZodRawShape>

export const bedrockProviderSpecificSettingsSchema = z.strictObject({
  region: z
    .string()
    .trim()
    .min(1)
    .meta({
      providerSettingUi: {
        labelKey: "region",
        type: "text",
        placeholder: "us-east-1",
      },
    }),
})

export const azureProviderSpecificSettingsSchema = z.strictObject({
  apiMode: z
    .enum(AZURE_API_MODES)
    .optional()
    .meta({
      providerSettingUi: {
        labelKey: "apiMode",
        type: "select",
        defaultValue: DEFAULT_AZURE_API_MODE,
        options: [
          { value: "responses", labelKey: "responses" },
          { value: "chat", labelKey: "chatCompletions" },
        ],
      },
    }),
  resourceName: z
    .string()
    .trim()
    .optional()
    .meta({
      providerSettingUi: {
        labelKey: "resourceName",
        type: "text",
        placeholder: "my-azure-openai-resource",
      },
    }),
  apiVersion: z
    .string()
    .trim()
    .optional()
    .meta({
      providerSettingUi: {
        labelKey: "apiVersion",
        type: "text",
        placeholder: "v1",
      },
    }),
})

/**
 * OpenRouter load balances each request across every provider serving the model unless told
 * otherwise. `only` pins the request to an explicit provider allow-list, which is what
 * "lock the provider" means here; leaving it empty keeps OpenRouter's default price-based
 * load balancing.
 *
 * Slugs are the ones OpenRouter prints on each model's provider list, and may target a
 * single endpoint variant (`deepinfra/turbo`) or region (`google-vertex/us-east5`) as well
 * as a whole provider (`deepinfra`).
 */
export const openrouterProviderSpecificSettingsSchema = z.strictObject({
  only: z
    .string()
    .trim()
    .optional()
    .meta({
      providerSettingUi: {
        labelKey: "onlyProviders",
        type: "text",
        placeholder: "deepinfra, together",
        hintKey: "onlyProvidersHint",
      },
    }),
})
export type OpenRouterProviderSpecificSettings = z.infer<
  typeof openrouterProviderSpecificSettingsSchema
>

export const PROVIDER_SPECIFIC_SETTINGS_SCHEMAS: Partial<
  Record<LLMProviderTypes, ProviderSpecificSettingsSchema>
> = {
  azure: azureProviderSpecificSettingsSchema,
  bedrock: bedrockProviderSpecificSettingsSchema,
  openrouter: openrouterProviderSpecificSettingsSchema,
}

export function getProviderSpecificSettingFields(
  schema: ProviderSpecificSettingsSchema,
): ProviderSpecificSettingField[] {
  return Object.entries(schema.shape).map(([key, fieldSchema]) => {
    const ui = (fieldSchema as z.ZodType).meta()?.providerSettingUi

    if (!ui) {
      throw new Error(`providerSpecificSettings.${key} is missing providerSettingUi metadata`)
    }

    if (ui.type !== "text" && ui.type !== "select") {
      const unsupportedTypeValue = (ui as { type: unknown }).type
      const unsupportedType =
        typeof unsupportedTypeValue === "string"
          ? unsupportedTypeValue
          : JSON.stringify(unsupportedTypeValue)
      throw new Error(`Unsupported providerSpecificSettings.${key} field type: ${unsupportedType}`)
    }

    return {
      key,
      ...ui,
    }
  })
}
