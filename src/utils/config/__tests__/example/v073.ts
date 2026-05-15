import type { VersionTestData } from "./types"
import { testSeries as v072TestSeries } from "./v072"

const DEPRECATED_PROVIDER_MODEL_FALLBACKS: Record<string, Record<string, string>> = {
  anthropic: {
    "claude-3-7-sonnet-latest": "claude-haiku-4-5",
    "claude-3-5-haiku-latest": "claude-haiku-4-5",
  },
  google: {
    "gemini-1.5-flash-8b": "gemini-2.5-flash-lite",
    "gemini-1.5-flash-8b-latest": "gemini-2.5-flash-lite",
    "gemini-1.5-flash": "gemini-2.5-flash-lite",
    "gemini-1.5-flash-latest": "gemini-2.5-flash-lite",
    "gemini-1.5-pro": "gemini-2.5-pro",
    "gemini-1.5-pro-latest": "gemini-2.5-pro",
  },
  xai: {
    "grok-4-0709": "grok-4.20-non-reasoning",
    "grok-4-latest": "grok-4.20-non-reasoning",
    "grok-4": "grok-4.20-non-reasoning",
    "grok-3-mini-fast": "grok-3-mini",
    "grok-3-mini-fast-latest": "grok-3-mini",
    "grok-3-mini-latest": "grok-3-mini",
    "grok-3-fast": "grok-3",
    "grok-3-fast-latest": "grok-3",
    "grok-3-latest": "grok-3",
    "grok-2": "grok-4.20-non-reasoning",
    "grok-2-latest": "grok-4.20-non-reasoning",
    "grok-2-1212": "grok-4.20-non-reasoning",
    "grok-2-vision": "grok-4.20-non-reasoning",
    "grok-2-vision-latest": "grok-4.20-non-reasoning",
    "grok-2-vision-1212": "grok-4.20-non-reasoning",
    "grok-beta": "grok-4.20-non-reasoning",
    "grok-vision-beta": "grok-4.20-non-reasoning",
  },
  bedrock: {
    "anthropic.claude-3-7-sonnet-20250219-v1:0": "us.amazon.nova-micro-v1:0",
    "us.anthropic.claude-3-7-sonnet-20250219-v1:0": "us.amazon.nova-micro-v1:0",
    "anthropic.claude-3-5-haiku-20241022-v1:0": "us.amazon.nova-micro-v1:0",
    "us.anthropic.claude-3-5-haiku-20241022-v1:0": "us.amazon.nova-micro-v1:0",
  },
  groq: {
    "meta-llama/llama-guard-4-12b": "llama-3.1-8b-instant",
    "llama-guard-3-8b": "llama-3.1-8b-instant",
    "meta-llama/llama-prompt-guard-2-22m": "llama-3.1-8b-instant",
    "meta-llama/llama-prompt-guard-2-86m": "llama-3.1-8b-instant",
  },
  deepseek: {
    "deepseek-v4-flash": "deepseek-chat",
    "deepseek-v4-pro": "deepseek-chat",
  },
}

function getNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function getMigratedCustomModel(modelConfig: { customModel?: unknown, isCustomModel?: unknown }, previousModel: string): string {
  if (modelConfig.isCustomModel === true) {
    return getNonEmptyString(modelConfig.customModel) ?? previousModel
  }

  return previousModel
}

export const testSeries = Object.fromEntries(
  Object.entries(v072TestSeries).map(([seriesId, seriesData]) => [
    seriesId,
    {
      ...seriesData,
      config: {
        ...seriesData.config,
        providersConfig: Array.isArray(seriesData.config.providersConfig)
          ? seriesData.config.providersConfig.map((providerConfig: typeof seriesData.config.providersConfig[number]) => {
              const provider = providerConfig.provider
              const previousModel = providerConfig.model?.model
              const fallbackModel = typeof provider === "string" && typeof previousModel === "string"
                ? DEPRECATED_PROVIDER_MODEL_FALLBACKS[provider]?.[previousModel]
                : undefined

              if (!fallbackModel) {
                return providerConfig
              }

              return {
                ...providerConfig,
                model: {
                  ...providerConfig.model,
                  model: fallbackModel,
                  isCustomModel: true,
                  customModel: getMigratedCustomModel(providerConfig.model, previousModel),
                },
              }
            })
          : seriesData.config.providersConfig,
      },
    },
  ]),
) as VersionTestData["testSeries"]
