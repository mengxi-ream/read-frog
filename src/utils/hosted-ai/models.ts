import type {
  HostedAiModelStatus,
  HostedAiModelTier,
  HostedAiReasoning,
  HostedAiStatus,
} from "./types"
import { dequal } from "dequal"
import { storage } from "#imports"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config-storage-key"
import { isBuiltInAiModelId } from "@/utils/constants/provider-ids"
import { createLogger } from "@/utils/logging/logger"

const log = createLogger("hosted-ai/models")

// A record rather than a list so that a level or tier the contract gains and
// these lack fails to compile.
const REASONING_LEVEL_SET = {
  none: true,
  minimal: true,
  low: true,
  medium: true,
  high: true,
  xhigh: true,
} as const satisfies Record<HostedAiReasoning, true>
const MODEL_TIER_SET = { normal: true, advance: true } as const satisfies Record<
  HostedAiModelTier,
  true
>

/** Every level this client can ask for, from the least reasoning to the most. */
export const HOSTED_AI_REASONING_LEVELS = Object.keys(REASONING_LEVEL_SET) as HostedAiReasoning[]

const HOSTED_AI_MODEL_TIERS = Object.keys(MODEL_TIER_SET) as HostedAiModelTier[]

/**
 * One Built-in AI model as this client can use it: what `hostedAi.status.models`
 * lists, keeping only the reasoning levels this client knows. A level added on
 * the server before this client learns it cannot be asked for anyway (the
 * contract's input schema would refuse it before the request leaves), so it is
 * not offered, and a default nobody here knows reads as null.
 */
export interface HostedAiModel extends Omit<HostedAiModelStatus, "reasoning"> {
  reasoning: {
    levels: HostedAiReasoning[]
    default: HostedAiReasoning | null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function isHostedAiReasoning(value: unknown): value is HostedAiReasoning {
  return (HOSTED_AI_REASONING_LEVELS as readonly unknown[]).includes(value)
}

function isHostedAiModelTier(value: unknown): value is HostedAiModelTier {
  return (HOSTED_AI_MODEL_TIERS as readonly unknown[]).includes(value)
}

function sanitizeHostedAiModel(entry: unknown): HostedAiModel | null {
  if (!isRecord(entry)) {
    return null
  }
  const { id, name, vendor, tier, modelRevision, reasoning, available } = entry
  if (typeof id !== "string" || !isBuiltInAiModelId(id)) {
    return null
  }
  // A tier this client does not know is a plan it cannot gate on, so the model
  // is left out rather than offered to accounts that may not reach it.
  if (!isHostedAiModelTier(tier)) {
    return null
  }
  if (typeof modelRevision !== "string" || modelRevision.trim() === "") {
    return null
  }
  // The contract has every model name its maker, so one that does not is
  // malformed like one without a revision.
  if (typeof vendor !== "string" || vendor.trim() === "") {
    return null
  }

  const offeredLevels =
    isRecord(reasoning) && Array.isArray(reasoning.levels) ? reasoning.levels : []
  const levels = HOSTED_AI_REASONING_LEVELS.filter((level) => offeredLevels.includes(level))
  const defaultLevel = isRecord(reasoning) ? reasoning.default : undefined

  return {
    id,
    name: typeof name === "string" && name.trim() !== "" ? name.trim() : id,
    vendor: vendor.trim(),
    tier,
    modelRevision,
    reasoning: {
      levels,
      default:
        isHostedAiReasoning(defaultLevel) && levels.includes(defaultLevel) ? defaultLevel : null,
    },
    // Fail open: a response without the flag says nothing against the model.
    available: typeof available === "boolean" ? available : true,
  }
}

/**
 * The models out of a `models` array, in the server's order. The status
 * response is not validated when it arrives, and a server can be newer than
 * this client, so malformed entries are dropped one by one instead of taking
 * the list with them. Null when there is no array at all: a server from before
 * models could be chosen, which is not the same as one offering none.
 */
export function sanitizeHostedAiModels(value: unknown): HostedAiModel[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const seen = new Set<string>()
  const models: HostedAiModel[] = []
  for (const entry of value) {
    const model = sanitizeHostedAiModel(entry)
    if (model && !seen.has(model.id)) {
      seen.add(model.id)
      models.push(model)
    }
  }
  return models
}

/** The models a status response lists, or null when it lists none at all. */
export function getHostedAiModelsFromStatus(
  status: HostedAiStatus | null | undefined,
): HostedAiModel[] | null {
  return sanitizeHostedAiModels((status as { models?: unknown } | null | undefined)?.models)
}

export function findHostedAiModel(
  models: readonly HostedAiModel[] | null | undefined,
  modelId: string,
): HostedAiModel | undefined {
  return models?.find((model) => model.id === modelId)
}

/** The model's display name, or its id when the list does not have it. */
export function getHostedAiModelName(
  models: readonly HostedAiModel[] | null | undefined,
  modelId: string,
): string {
  return findHostedAiModel(models, modelId)?.name ?? modelId
}

/**
 * Local, so the last list survives the browser restarting: the options page,
 * the provider menus and the config migration's choices keep their model names
 * while status cannot be fetched.
 */
const STORED_MODELS_KEY = "local:hostedAiModels" as const

interface StoredHostedAiModels {
  models: HostedAiModel[]
  savedAt: number
}

/** The last model list this extension saw, or null when it has never seen one. */
export async function readStoredHostedAiModels(): Promise<HostedAiModel[] | null> {
  try {
    const stored = await storage.getItem<StoredHostedAiModels>(STORED_MODELS_KEY)
    return sanitizeHostedAiModels(stored?.models)
  } catch (error) {
    log.warn("Failed to read the stored model list", { error })
    return null
  }
}

/**
 * Keep the list for when status cannot be fetched. Every context that fetches
 * status saves what it got, so the write is skipped when nothing changed: each
 * one would otherwise wake every storage watcher for the same list.
 */
export async function storeHostedAiModels(models: readonly HostedAiModel[]): Promise<void> {
  try {
    const stored = await storage.getItem<StoredHostedAiModels>(STORED_MODELS_KEY)
    if (stored && dequal(stored.models, models)) {
      return
    }
    await storage.setItem<StoredHostedAiModels>(STORED_MODELS_KEY, {
      models: [...models],
      savedAt: Date.now(),
    })
  } catch (error) {
    log.warn("Failed to store the model list", { error })
  }
}

export function watchStoredHostedAiModels(
  callback: (models: HostedAiModel[] | null) => void,
): () => void {
  return storage.watch<StoredHostedAiModels>(STORED_MODELS_KEY, (stored) => {
    callback(sanitizeHostedAiModels(stored?.models))
  })
}

/**
 * The level the model's reasoning control shows: the user's choice when the
 * model takes it, otherwise the model's default.
 */
export function getEffectiveHostedAiReasoning(
  model: HostedAiModel,
  choice: string | undefined,
): HostedAiReasoning | null {
  return isHostedAiReasoning(choice) && model.reasoning.levels.includes(choice)
    ? choice
    : model.reasoning.default
}

/**
 * The `reasoning` a request carries: the level the model's control shows, so
 * the request runs what the user sees, and a cache entry is filed under the
 * level that wrote it. Language detection carries none: the server always runs
 * it at the default. When the list does not know the model, the user's choice
 * goes as it is (the server runs a level a model does not take at its
 * default), and with no choice either, nothing.
 */
export function getRequestedHostedAiReasoning(
  model: HostedAiModel | undefined,
  choice: string | undefined,
  options: { languageDetection: boolean },
): HostedAiReasoning | undefined {
  if (options.languageDetection) {
    return undefined
  }
  if (model) {
    return getEffectiveHostedAiReasoning(model, choice) ?? undefined
  }
  return isHostedAiReasoning(choice) ? choice : undefined
}

/**
 * The reasoning level the user picked for a model, read straight from the
 * stored config. Raw on purpose: the background resolves this for every hosted
 * call, and parsing the whole config each time would cost far more than the
 * one field it needs. The value is checked against the levels this client
 * knows, so whatever is stored can never reach the request unvetted.
 */
export async function readHostedAiReasoningChoice(
  modelId: string,
): Promise<HostedAiReasoning | undefined> {
  try {
    const config = await storage.getItem<unknown>(`local:${CONFIG_STORAGE_KEY}`)
    const models =
      isRecord(config) && isRecord(config.builtInAi) ? config.builtInAi.models : undefined
    const settings = isRecord(models) ? models[modelId] : undefined
    const reasoning = isRecord(settings) ? settings.reasoning : undefined
    return isHostedAiReasoning(reasoning) ? reasoning : undefined
  } catch (error) {
    log.warn("Failed to read the reasoning level", { error })
    return undefined
  }
}
