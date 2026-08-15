import type {
  APIProviderTypes,
  DedicatedLLMProviderTypes,
  LLMProviderTypes,
  NonAPIProviderTypes,
  OpenAICompatibleLLMProviderTypes,
  OpenResponsesLLMProviderTypes,
  ProtocolCompatibleLLMProviderTypes,
  PureAPIProviderTypes,
  TopLevelReasoningProviderTypes,
  TranslateProviderTypes,
} from "./constants"
import { z } from "zod"
import {
  AI_SDK_REASONING_VALUES,
  LLM_PROVIDER_MODELS,
  isCustomModelOnlyProvider,
} from "./constants"
import {
  azureProviderSpecificSettingsSchema,
  bedrockProviderSpecificSettingsSchema,
} from "./provider-specific-settings"

export const providerSponsorConfigSchema = z.object({
  sponsoring: z.boolean(),
  referUrl: z.url(),
  /**
   * i18n keys overriding the generic "Sponsor" badge and its call to action, for a sponsor
   * whose offer is worth naming outright. Absent means the shared wording.
   */
  badgeI18nKey: z.string().optional(),
  ctaI18nKey: z.string().optional(),
})
export type ProviderSponsorConfig = z.infer<typeof providerSponsorConfigSchema>

/* ──────────────────────────────
  Providers config schema
  ────────────────────────────── */

// Helper function to create provider-specific model schema
function createProviderModelSchema<T extends LLMProviderTypes>(provider: T) {
  const models = LLM_PROVIDER_MODELS[provider]
  return z.object({
    model: z.enum(models),
    isCustomModel: isCustomModelOnlyProvider(provider) ? z.literal(true) : z.boolean(),
    customModel: z.string().nullable(),
  })
}

// Base schema without models
export const baseProviderConfigSchema = z.strictObject({
  id: z.string().nonempty(),
  name: z.string().nonempty(),
  description: z.string().optional(),
  enabled: z.boolean(),
})

export const baseAPIProviderConfigSchema = baseProviderConfigSchema.extend({
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  temperature: z.number().min(0).optional(),
  providerOptions: z.record(z.string(), z.any()).optional(),
  headers: z.record(z.string(), z.any()).optional(),
})

export const baseOpenAICompatibleLLMProviderConfigSchema = baseAPIProviderConfigSchema.extend({
  baseURL: z.string(),
})

export const baseOpenResponsesLLMProviderConfigSchema = baseAPIProviderConfigSchema
  .omit({ baseURL: true })
  .extend({
    url: z.string(),
  })

const topLevelReasoningConfigSchema = {
  reasoning: z.enum(AI_SDK_REASONING_VALUES).optional(),
}

const llmProviderConfigSchemaList = [
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("atlascloud"),
    model: createProviderModelSchema<"atlascloud">("atlascloud"),
  }),
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("jalapenocloud"),
    model: createProviderModelSchema<"jalapenocloud">("jalapenocloud"),
  }),
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("siliconflow"),
    model: createProviderModelSchema<"siliconflow">("siliconflow"),
  }),
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("tensdaq"),
    model: createProviderModelSchema<"tensdaq">("tensdaq"),
  }),
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("volcengine"),
    model: createProviderModelSchema<"volcengine">("volcengine"),
  }),
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("openai-compatible"),
    model: createProviderModelSchema<"openai-compatible">("openai-compatible"),
  }),
  baseOpenResponsesLLMProviderConfigSchema.extend({
    provider: z.literal("open-responses"),
    model: createProviderModelSchema<"open-responses">("open-responses"),
  }),
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("openrouter"),
    model: createProviderModelSchema<"openrouter">("openrouter"),
  }),
  baseOpenAICompatibleLLMProviderConfigSchema.extend({
    provider: z.literal("minimax"),
    model: createProviderModelSchema<"minimax">("minimax"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("openai"),
    model: createProviderModelSchema<"openai">("openai"),
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("azure"),
    model: createProviderModelSchema<"azure">("azure"),
    providerSpecificSettings: azureProviderSpecificSettingsSchema.optional(),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("deepseek"),
    model: createProviderModelSchema<"deepseek">("deepseek"),
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("google"),
    model: createProviderModelSchema<"google">("google"),
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("anthropic"),
    model: createProviderModelSchema<"anthropic">("anthropic"),
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("xai"),
    model: createProviderModelSchema<"xai">("xai"),
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("bedrock"),
    model: createProviderModelSchema<"bedrock">("bedrock"),
    providerSpecificSettings: bedrockProviderSpecificSettingsSchema,
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("groq"),
    model: createProviderModelSchema<"groq">("groq"),
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("deepinfra"),
    model: createProviderModelSchema<"deepinfra">("deepinfra"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("mistral"),
    model: createProviderModelSchema<"mistral">("mistral"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("togetherai"),
    model: createProviderModelSchema<"togetherai">("togetherai"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("cohere"),
    model: createProviderModelSchema<"cohere">("cohere"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("fireworks"),
    model: createProviderModelSchema<"fireworks">("fireworks"),
    ...topLevelReasoningConfigSchema,
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("cerebras"),
    model: createProviderModelSchema<"cerebras">("cerebras"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("replicate"),
    model: createProviderModelSchema<"replicate">("replicate"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("perplexity"),
    model: createProviderModelSchema<"perplexity">("perplexity"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("vercel"),
    model: createProviderModelSchema<"vercel">("vercel"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("ollama"),
    model: createProviderModelSchema<"ollama">("ollama"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("alibaba"),
    model: createProviderModelSchema<"alibaba">("alibaba"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("moonshotai"),
    model: createProviderModelSchema<"moonshotai">("moonshotai"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("huggingface"),
    model: createProviderModelSchema<"huggingface">("huggingface"),
  }),
] as const

const apiProviderConfigSchemaList = [
  ...llmProviderConfigSchemaList,
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("deeplx"),
  }),
  baseAPIProviderConfigSchema.extend({
    provider: z.literal("deepl"),
  }),
] as const

export const providerConfigSchemaList = [
  ...apiProviderConfigSchemaList,
  baseProviderConfigSchema.extend({
    provider: z.literal("google-translate"),
  }),
  baseProviderConfigSchema.extend({
    provider: z.literal("microsoft-translate"),
  }),
] as const

export const llmProviderConfigItemSchema = z.discriminatedUnion(
  "provider",
  llmProviderConfigSchemaList,
)
export const apiProviderConfigItemSchema = z.discriminatedUnion(
  "provider",
  apiProviderConfigSchemaList,
)
export const providerConfigItemSchema = z.discriminatedUnion("provider", providerConfigSchemaList)

export const providersConfigSchema = z
  .array(providerConfigItemSchema)
  .superRefine((providers, ctx) => {
    const idSet = new Set<string>()
    providers.forEach((provider, index) => {
      if (idSet.has(provider.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate provider id "${provider.id}"`,
          path: [index, "id"],
        })
      }
      idSet.add(provider.id)
    })

    const nameSet = new Set<string>()
    providers.forEach((provider, index) => {
      if (nameSet.has(provider.name)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate provider name "${provider.name}"`,
          path: [index, "name"],
        })
      }
      nameSet.add(provider.name)
    })
  })
export type ProvidersConfig = z.infer<typeof providersConfigSchema>
export type ProviderConfig = ProvidersConfig[number]
export type NonAPIProviderConfig = Extract<ProviderConfig, { provider: NonAPIProviderTypes }>
export type PureProviderConfig = Extract<ProviderConfig, { provider: PureAPIProviderTypes }>
export type APIProviderConfig = Extract<ProviderConfig, { provider: APIProviderTypes }>
export type PureAPIProviderConfig = Extract<ProviderConfig, { provider: PureAPIProviderTypes }>
export type LLMProviderConfig = Extract<ProviderConfig, { provider: LLMProviderTypes }>
export type TranslateProviderConfig = Extract<ProviderConfig, { provider: TranslateProviderTypes }>
export type OpenAICompatibleLLMProviderConfig = Extract<
  ProviderConfig,
  { provider: OpenAICompatibleLLMProviderTypes }
>
export type OpenResponsesLLMProviderConfig = Extract<
  ProviderConfig,
  { provider: OpenResponsesLLMProviderTypes }
>
export type ProtocolCompatibleLLMProviderConfig = Extract<
  ProviderConfig,
  { provider: ProtocolCompatibleLLMProviderTypes }
>
export type DedicatedLLMProviderConfig = Extract<
  ProviderConfig,
  { provider: DedicatedLLMProviderTypes }
>
export type TopLevelReasoningProviderConfig = Extract<
  LLMProviderConfig,
  { provider: TopLevelReasoningProviderTypes }
>

/* ──────────────────────────────
  unified llm model config helpers
  ────────────────────────────── */

type ModelTuple = readonly [string, ...string[]] // 至少一个元素才能给 z.enum
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- T preserves literal model tuple inference for z.enum.
function providerConfigSchema<T extends ModelTuple>(models: T) {
  return z.object({
    model: z.enum(models),
    isCustomModel: z.boolean(),
    customModel: z.string().nullable(),
  })
}

type SchemaShape<M extends Record<string, ModelTuple>> = {
  [K in keyof M]: ReturnType<typeof providerConfigSchema<M[K]>>
}

function buildProviderModelsSchema<M extends Record<string, ModelTuple>>(models: M) {
  return z.object(
    // Keep key names and types when building schema dynamically.
    (Object.keys(models) as (keyof M)[]).reduce((acc, key) => {
      acc[key] = providerConfigSchema(models[key])
      return acc
    }, {} as SchemaShape<M>),
  )
}

const {
  "openai-compatible": _openAICompatible,
  "open-responses": _openResponses,
  ...modelsWithSelectableDefaults
} = LLM_PROVIDER_MODELS
export const llmProviderModelsSchema = buildProviderModelsSchema(
  modelsWithSelectableDefaults,
).extend({
  "openai-compatible": z.object({
    model: z.enum(LLM_PROVIDER_MODELS["openai-compatible"]),
    isCustomModel: z.literal(true),
    customModel: z.string().nullable(),
  }),
  "open-responses": z.object({
    model: z.enum(LLM_PROVIDER_MODELS["open-responses"]),
    isCustomModel: z.literal(true),
    customModel: z.string().nullable(),
  }),
})
export type LLMProviderModels = z.infer<typeof llmProviderModelsSchema>
