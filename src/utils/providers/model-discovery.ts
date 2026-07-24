import type { LLMProviderConfig, NonCustomLLMProviderTypes } from "@/types/config/provider"
import { isCustomLLMProviderConfig } from "@/types/config/provider"
import { extractErrorMessage } from "@/utils/error/extract-message"
import { getProviderHeadersWithOverride } from "./headers"

/**
 * Declarative model-discovery registry.
 *
 * Each entry describes where a provider exposes its "list models" API and which
 * of the shared response shapes it uses. Fetched ids augment the existing model
 * selector and selected unknown ids flow through the custom-model channel, so
 * the static `LLM_PROVIDER_MODELS` lists remain the source of truth.
 */

type ModelDiscoveryKind = "openai-compatible" | "google" | "anthropic"

interface ModelDiscoveryDescriptor {
  kind: ModelDiscoveryKind
  baseURL: string
  requiresAPIKey?: boolean
}

const MAX_PAGES = 10
const UNSUPPORTED_MODEL_TYPES = new Set(["embedding", "image", "moderation", "rerank"])
// Catalog entries without capability metadata (plain { id } shapes) are matched by
// id against the common non-text model families instead.
const NON_TEXT_MODEL_ID_PATTERN =
  /\b(?:embed(?:ding)?s?|whisper|tts|dall-e|moderation|audio|realtime|transcribe|rerank(?:er)?|image|sora)\b/i

export const MODEL_DISCOVERY_DESCRIPTORS: Partial<
  Record<NonCustomLLMProviderTypes, ModelDiscoveryDescriptor>
> = {
  openai: { kind: "openai-compatible", baseURL: "https://api.openai.com/v1" },
  deepseek: { kind: "openai-compatible", baseURL: "https://api.deepseek.com" },
  google: { kind: "google", baseURL: "https://generativelanguage.googleapis.com/v1beta" },
  anthropic: { kind: "anthropic", baseURL: "https://api.anthropic.com/v1" },
  xai: { kind: "openai-compatible", baseURL: "https://api.x.ai/v1" },
  groq: { kind: "openai-compatible", baseURL: "https://api.groq.com/openai/v1" },
  deepinfra: {
    kind: "openai-compatible",
    baseURL: "https://api.deepinfra.com/v1/openai",
    requiresAPIKey: false,
  },
  mistral: { kind: "openai-compatible", baseURL: "https://api.mistral.ai/v1" },
  togetherai: { kind: "openai-compatible", baseURL: "https://api.together.ai/v1" },
  cerebras: { kind: "openai-compatible", baseURL: "https://api.cerebras.ai/v1" },
  alibaba: {
    kind: "openai-compatible",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  moonshotai: { kind: "openai-compatible", baseURL: "https://api.moonshot.ai/v1" },
  huggingface: {
    kind: "openai-compatible",
    baseURL: "https://router.huggingface.co/v1",
    requiresAPIKey: false,
  },
}

function dedupe(models: string[]): string[] {
  return [...new Set(models.map((model) => model.trim()).filter(Boolean))]
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function supportsTextGeneration(entry: unknown): boolean {
  const record = asRecord(entry)
  if (!record) return true

  if (record.deprecated === true) {
    return false
  }

  const type = asString(record.type)?.toLowerCase()
  if (type && UNSUPPORTED_MODEL_TYPES.has(type)) {
    return false
  }

  const outputModalities = asRecord(record.architecture)?.output_modalities
  if (
    Array.isArray(outputModalities) &&
    !outputModalities.some((modality) => modality === "text")
  ) {
    return false
  }

  const capabilities = asRecord(record.capabilities)
  for (const key of ["completion_chat", "completion", "chat"]) {
    const capability = capabilities?.[key]
    if (typeof capability === "boolean") {
      return capability
    }
  }

  const tags = asRecord(record.metadata)?.tags
  if (Array.isArray(tags)) {
    return tags.includes("chat")
  }

  return true
}

function getModelEntries(data: unknown): unknown[] {
  if (Array.isArray(data)) return data

  const record = asRecord(data)
  return Array.isArray(record?.data) ? record.data : []
}

function getModelId(entry: unknown): string {
  if (typeof entry === "string") return entry

  const record = asRecord(entry)
  return asString(record?.id) ?? asString(record?.name) ?? ""
}

function getModelsURL(baseURL: string): string {
  return `${baseURL.replace(/\/+$/, "")}/models`
}

async function fetchJSON(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(url, { headers, ...(signal ? { signal } : {}) })
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response))
  }
  return response.json()
}

export async function fetchOpenAICompatibleModels(
  baseURL: string,
  apiKey?: string,
  extraHeaders?: Record<string, string>,
  signal?: AbortSignal,
): Promise<string[]> {
  // Auth first, then configured headers, so user headers can override the derived
  // auth header — the same precedence the AI SDK provider clients use.
  const data = await fetchJSON(
    getModelsURL(baseURL),
    {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...extraHeaders,
    },
    signal,
  )
  // Most providers return { data: [{ id }] }; a few return a bare array or use `name`.
  return dedupe(
    getModelEntries(data)
      .filter(supportsTextGeneration)
      .map(getModelId)
      .filter((id) => !NON_TEXT_MODEL_ID_PATTERN.test(id)),
  )
}


export async function fetchGoogleModels(
  baseURL: string,
  apiKey: string,
  extraHeaders?: Record<string, string>,
  signal?: AbortSignal,
): Promise<string[]> {
  const models: string[] = []
  let pageToken: string | undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(getModelsURL(baseURL))
    url.searchParams.set("pageSize", "1000")
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken)
    }

    const data = await fetchJSON(
      url.toString(),
      { "x-goog-api-key": apiKey, ...extraHeaders },
      signal,
    )
    const records = asRecord(data)?.models
    for (const model of Array.isArray(records) ? records : []) {
      const record = asRecord(model)
      const methods = [record?.supportedGenerationMethods, record?.supportedActions].flatMap(
        (value) =>
          (Array.isArray(value) ? value : []).filter(
            (item): item is string => typeof item === "string",
          ),
      )
      const name = asString(record?.name)
      if (methods.includes("generateContent") && name) {
        models.push(name.replace(/^models\//, ""))
      }
    }

    pageToken = asString(asRecord(data)?.nextPageToken)
    if (!pageToken) break
  }

  return dedupe(models)
}

export async function fetchAnthropicModels(
  baseURL: string,
  apiKey: string,
  extraHeaders?: Record<string, string>,
  signal?: AbortSignal,
): Promise<string[]> {
  const models: string[] = []
  let afterId: string | undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(getModelsURL(baseURL))
    url.searchParams.set("limit", "1000")
    if (afterId) {
      url.searchParams.set("after_id", afterId)
    }

    const data = await fetchJSON(
      url.toString(),
      {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        ...extraHeaders,
      },
      signal,
    )
    for (const entry of getModelEntries(data)) {
      models.push(getModelId(entry))
    }

    const record = asRecord(data)
    afterId = record?.has_more === true ? asString(record.last_id) : undefined
    if (!afterId) break
  }

  return dedupe(models)
}

const MODEL_FETCHERS: Record<
  ModelDiscoveryKind,
  (
    baseURL: string,
    apiKey: string,
    extraHeaders?: Record<string, string>,
    signal?: AbortSignal,
  ) => Promise<string[]>
> = {
  "openai-compatible": fetchOpenAICompatibleModels,
  google: fetchGoogleModels,
  anthropic: fetchAnthropicModels,
}

export interface ModelDiscovery {
  /** Resolved list endpoint origin; also identifies the fetch target for cache resets. */
  endpoint: string
  fetchModels: (signal?: AbortSignal) => Promise<string[]>
}

/**
 * Build a model-list fetcher for the given provider config, or return undefined
 * when the provider has no known list endpoint.
 */
export function getModelDiscovery(providerConfig: LLMProviderConfig): ModelDiscovery | undefined {
  const extraHeaders = getProviderHeadersWithOverride(
    providerConfig.provider,
    "headers" in providerConfig ? providerConfig.headers : undefined,
  )

  if (isCustomLLMProviderConfig(providerConfig)) {
    const baseURL = providerConfig.baseURL?.trim()
    const apiKey = providerConfig.apiKey?.trim()
    if (!baseURL) {
      return undefined
    }
    return {
      endpoint: baseURL,
      fetchModels: async (signal) =>
        fetchOpenAICompatibleModels(baseURL, apiKey, extraHeaders, signal),
    }
  }

  const descriptor = MODEL_DISCOVERY_DESCRIPTORS[providerConfig.provider]
  if (!descriptor) {
    return undefined
  }

  const configuredBaseURL = "baseURL" in providerConfig ? providerConfig.baseURL?.trim() : undefined
  const baseURL = configuredBaseURL || descriptor.baseURL
  const apiKey = "apiKey" in providerConfig ? providerConfig.apiKey?.trim() : undefined
  if (descriptor.requiresAPIKey !== false && !apiKey) {
    return undefined
  }
  const fetchModels = MODEL_FETCHERS[descriptor.kind]

  return {
    endpoint: baseURL,
    fetchModels: async (signal) => fetchModels(baseURL, apiKey ?? "", extraHeaders, signal),
  }
}
