import { z } from "zod";
import { LLM_PROVIDER_MODELS } from "./constants";
import { bedrockProviderSpecificSettingsSchema } from "./provider-specific-settings";
/* ──────────────────────────────
  Providers config schema
  ────────────────────────────── */
// Helper function to create provider-specific model schema
function createProviderModelSchema(provider) {
    const models = LLM_PROVIDER_MODELS[provider];
    return z.object({
        model: z.enum(models),
        isCustomModel: provider === "openai-compatible" ? z.literal(true) : z.boolean(),
        customModel: z.string().nullable(),
    });
}
// Base schema without models
export const baseProviderConfigSchema = z.strictObject({
    id: z.string().nonempty(),
    name: z.string().nonempty(),
    description: z.string().optional(),
    enabled: z.boolean(),
});
export const baseAPIProviderConfigSchema = baseProviderConfigSchema.extend({
    apiKey: z.string().optional(),
    baseURL: z.string().optional(),
    temperature: z.number().min(0).optional(),
    providerOptions: z.record(z.string(), z.any()).optional(),
    headers: z.record(z.string(), z.any()).optional(),
});
export const baseCustomLLMProviderConfigSchema = baseAPIProviderConfigSchema.extend({
    baseURL: z.string(),
});
const llmProviderConfigSchemaList = [
    baseCustomLLMProviderConfigSchema.extend({
        provider: z.literal("siliconflow"),
        model: createProviderModelSchema("siliconflow"),
    }),
    baseCustomLLMProviderConfigSchema.extend({
        provider: z.literal("tensdaq"),
        model: createProviderModelSchema("tensdaq"),
    }),
    baseCustomLLMProviderConfigSchema.extend({
        provider: z.literal("volcengine"),
        model: createProviderModelSchema("volcengine"),
    }),
    baseCustomLLMProviderConfigSchema.extend({
        provider: z.literal("openai-compatible"),
        model: createProviderModelSchema("openai-compatible"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("openai"),
        model: createProviderModelSchema("openai"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("deepseek"),
        model: createProviderModelSchema("deepseek"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("google"),
        model: createProviderModelSchema("google"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("anthropic"),
        model: createProviderModelSchema("anthropic"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("xai"),
        model: createProviderModelSchema("xai"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("bedrock"),
        model: createProviderModelSchema("bedrock"),
        providerSpecificSettings: bedrockProviderSpecificSettingsSchema,
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("groq"),
        model: createProviderModelSchema("groq"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("deepinfra"),
        model: createProviderModelSchema("deepinfra"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("mistral"),
        model: createProviderModelSchema("mistral"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("togetherai"),
        model: createProviderModelSchema("togetherai"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("cohere"),
        model: createProviderModelSchema("cohere"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("fireworks"),
        model: createProviderModelSchema("fireworks"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("cerebras"),
        model: createProviderModelSchema("cerebras"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("replicate"),
        model: createProviderModelSchema("replicate"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("perplexity"),
        model: createProviderModelSchema("perplexity"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("vercel"),
        model: createProviderModelSchema("vercel"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("openrouter"),
        model: createProviderModelSchema("openrouter"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("ollama"),
        model: createProviderModelSchema("ollama"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("minimax"),
        model: createProviderModelSchema("minimax"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("alibaba"),
        model: createProviderModelSchema("alibaba"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("moonshotai"),
        model: createProviderModelSchema("moonshotai"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("huggingface"),
        model: createProviderModelSchema("huggingface"),
    }),
];
const apiProviderConfigSchemaList = [
    ...llmProviderConfigSchemaList,
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("deeplx"),
    }),
    baseAPIProviderConfigSchema.extend({
        provider: z.literal("deepl"),
    }),
];
export const providerConfigSchemaList = [
    ...apiProviderConfigSchemaList,
    baseProviderConfigSchema.extend({
        provider: z.literal("google-translate"),
    }),
    baseProviderConfigSchema.extend({
        provider: z.literal("microsoft-translate"),
    }),
];
export const llmProviderConfigItemSchema = z.discriminatedUnion("provider", llmProviderConfigSchemaList);
export const apiProviderConfigItemSchema = z.discriminatedUnion("provider", apiProviderConfigSchemaList);
export const providerConfigItemSchema = z.discriminatedUnion("provider", providerConfigSchemaList);
export const providersConfigSchema = z.array(providerConfigItemSchema).superRefine((providers, ctx) => {
    const idSet = new Set();
    providers.forEach((provider, index) => {
        if (idSet.has(provider.id)) {
            ctx.addIssue({
                code: "custom",
                message: `Duplicate provider id "${provider.id}"`,
                path: [index, "id"],
            });
        }
        idSet.add(provider.id);
    });
    const nameSet = new Set();
    providers.forEach((provider, index) => {
        if (nameSet.has(provider.name)) {
            ctx.addIssue({
                code: "custom",
                message: `Duplicate provider name "${provider.name}"`,
                path: [index, "name"],
            });
        }
        nameSet.add(provider.name);
    });
});
function providerConfigSchema(models) {
    return z.object({
        model: z.enum(models),
        isCustomModel: z.boolean(),
        customModel: z.string().nullable(),
    });
}
function buildProviderModelsSchema(models) {
    return z.object(
    // Keep key names and types when building schema dynamically.
    Object.keys(models).reduce((acc, key) => {
        acc[key] = providerConfigSchema(models[key]);
        return acc;
    }, {}));
}
const { "openai-compatible": _, ollama: _ollama, ...modelsWithoutOpenaiCompatibleAndOllama } = LLM_PROVIDER_MODELS;
export const llmProviderModelsSchema = buildProviderModelsSchema(modelsWithoutOpenaiCompatibleAndOllama).extend({
    "openai-compatible": z.object({
        model: z.enum(LLM_PROVIDER_MODELS["openai-compatible"]),
        isCustomModel: z.literal(true),
        customModel: z.string().nullable(),
    }),
    "ollama": z.object({
        model: z.enum(LLM_PROVIDER_MODELS.ollama),
        isCustomModel: z.boolean(),
        customModel: z.string().nullable(),
    }),
});
