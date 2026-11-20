import type { ResolvedProviderRef, SystemProviderRef } from "./provider-registry"
import type { HostedAiTextStreamRoute } from "@/types/background-stream"
import type { Config } from "@/types/config/config"
import type { LLMProviderConfig, TranslateProviderConfig } from "@/types/config/provider"
import type { ErrorAction } from "@/utils/error-action"
import type { HostedAiModel } from "@/utils/hosted-ai/models"
import type { HostedAiModelVerdict } from "@/utils/hosted-ai/status"
import type {
  HostedAiFeature,
  HostedAiModelTier,
  HostedAiReasoning,
  HostedAiStatus,
} from "@/utils/hosted-ai/types"
import { isLLMProviderConfig } from "@/types/config/provider"
import {
  chooseHostedAiModelAction,
  getHostedAiModelUnavailableMessage,
} from "@/utils/hosted-ai/model-errors"
import {
  findHostedAiModel,
  getRequestedHostedAiReasoning,
  readHostedAiReasoningChoice,
  readStoredHostedAiModels,
} from "@/utils/hosted-ai/models"
import {
  getHostedAiCreditForFeature,
  getHostedAiModelVerdict,
  getHostedAiTierDescription,
} from "@/utils/hosted-ai/status"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { resolveProviderRefForCapability } from "./provider-registry"

/**
 * A provider flattened for structured-clone transport to the background. Local
 * providers carry their whole config; Built-in AI models carry what the hosted
 * call and the cache key need, resolved together so a cache entry is filed
 * under exactly what produced it.
 */
export type SerializableProviderRef =
  | { kind: "local"; config: TranslateProviderConfig }
  | SystemSerializableProviderRef

export interface SystemSerializableProviderRef {
  kind: "system"
  providerId: SystemProviderRef["id"]
  /** The model's id in the server's catalog. */
  model: string
  /** The model's tier, for older servers; one that knows models goes by `model`. */
  modelTier: HostedAiModelTier
  /** Changes when the model's output would. */
  modelRevision: string
  /**
   * The reasoning level the request asks for (see
   * `getRequestedHostedAiReasoning`). Null asks for none: language detection,
   * or a model this client knows nothing about with no level picked.
   */
  reasoning: HostedAiReasoning | null
}

/**
 * A ref that can be prompted for free-form text. Structural, not branded:
 * `LLMProviderConfig` is a real subtype of `TranslateProviderConfig`, so this
 * stays assignable to `SerializableProviderRef` — caches, transport and
 * `getProviderCacheIdentity` see no difference.
 *
 * Message payloads that prompt a model require this type, which turns
 * "forgot the promptability check" from a silent per-request failure into a
 * compile error at the sender: the only way to produce one is
 * `canProviderRefGenerateText` or a resolution that applied it.
 */
export type PromptableProviderRef =
  | { kind: "local"; config: LLMProviderConfig }
  | SystemSerializableProviderRef

export class HostedAiProviderUnavailableError extends Error {
  constructor(
    readonly provider: SystemProviderRef,
    message: string,
    /** What the user can do about it, such as choosing another model. */
    readonly action?: ErrorAction,
  ) {
    super(message)
    this.name = "HostedAiProviderUnavailableError"
  }
}

export function resolvePageTranslationProvider(
  config: Config,
): ResolvedProviderRef<TranslateProviderConfig> {
  const resolved = resolveProviderRefForCapability(
    "pageTranslation",
    config.providersConfig,
    config.pageTranslation.providerId,
  )
  if (!resolved) {
    throw new Error(`No page translation provider for id "${config.pageTranslation.providerId}"`)
  }
  return resolved
}

export function resolvePageTranslationProviderOrNull(
  config: Config,
): ResolvedProviderRef<TranslateProviderConfig> | null {
  try {
    return resolvePageTranslationProvider(config)
  } catch {
    return null
  }
}

/**
 * Cache-identity fallback for a status-fetch failure. The translate endpoint
 * never sees this value. Entries cached under it during one outage can be
 * served during a later outage even across a real revision bump — accepted:
 * the overlap is rare and the alternative is failing the translation.
 */
const UNKNOWN_MODEL_REVISION = "unknown"

/**
 * Cache identity for a provider. Local providers hash their whole config, so a
 * changed key or temperature invalidates; a Built-in AI model hashes its id
 * (inside the provider id), its revision, which the server bumps when its
 * output changes, and the reasoning level the request runs at. One helper so
 * every cache (page, subtitles, summaries, segmentation) keys the same way — a
 * local ref still stringifies byte-identically to what those caches used
 * before, so existing BYOK entries survive.
 */
export function getProviderCacheIdentity(ref: SerializableProviderRef): string {
  return ref.kind === "local"
    ? JSON.stringify(ref.config)
    : JSON.stringify({
        providerId: ref.providerId,
        modelRevision: ref.modelRevision,
        reasoning: ref.reasoning,
      })
}

/**
 * Whether this ref can be prompted for free-form text.
 *
 * Capability and promptability are not the same question. A feature's provider
 * list is capability-gated — `videoSubtitles` admits any translate provider —
 * but a summary is a generation, and Google, Microsoft and DeepLX have no model
 * to prompt. Without this, enqueueing a summary for a translate-only subtitles
 * provider is admitted to the queue and can only ever throw, after burning its
 * retries.
 */
export function canProviderRefGenerateText(
  ref: SerializableProviderRef,
): ref is PromptableProviderRef {
  return ref.kind === "system" || isLLMProviderConfig(ref.config)
}

/**
 * Pre-serialization twin of `canProviderRefGenerateText`: the same
 * promptability question, asked of the registry's resolved ref before a
 * hostedAi.status fetch is spent on it. Keep the pair in sync.
 */
export function canResolvedProviderRefGenerateText(
  ref: ResolvedProviderRef,
): ref is ResolvedProviderRef<LLMProviderConfig> {
  return ref.kind === "system" || isLLMProviderConfig(ref.config)
}

/**
 * Routes map many-to-one onto features: both subtitle routes bill against
 * `videoSubtitles`. The status gate is per feature, so collapse first.
 */
export function getHostedFeatureForRoute(route: HostedAiTextStreamRoute): HostedAiFeature {
  return route === "videoSubtitlesSegmentation" ? "videoSubtitles" : route
}

/**
 * The in-flight status ask, shared by every caller in this frame that overlaps
 * it.
 *
 * One status response covers all features and tiers, but resolution happens per
 * unit of work: page translation resolves per paragraph and runs paragraphs in
 * parallel, subtitles resolve per cue batch. Without coalescing, each of those
 * issues its own round trip for the same answer, and every one of them is
 * serialized ahead of the work it gates.
 *
 * Coalescing and caching solve different halves of that: this collapses callers
 * that overlap, and the background's short-TTL entry collapses the serialized
 * ones that do not (a subtitle run resolves one batch at a time, so it never
 * overlaps itself). Both are needed.
 */
let inflightStatus: Promise<HostedAiStatus | undefined> | null = null

/**
 * The background owns the response and its cache — content scripts cannot read
 * the session storage it lives in, and one entry there serves every tab.
 */
export function fetchHostedAiStatus(): Promise<HostedAiStatus | undefined> {
  if (inflightStatus) {
    return inflightStatus
  }

  // Fail open when the status endpoint is unreachable: the generation endpoints
  // enforce access on their own, so a status-only outage must not block
  // translation. Only an explicit server verdict blocks, in
  // `serializeProviderRef`. Both the null verdict and the throw collapse to the
  // same `undefined` here, and inside the shared promise so every sharer sees it.
  const pending = (async (): Promise<HostedAiStatus | undefined> => {
    try {
      return (await sendMessage("getHostedAiStatus")) ?? undefined
    } catch {
      return undefined
    }
  })()

  inflightStatus = pending.finally(() => {
    inflightStatus = null
  })

  return inflightStatus
}

/**
 * The error for a model the server will not run: it is missing from the list
 * or cannot run now. Names the models this account can run instead, with a
 * button to the settings for the first of them. It never switches by itself:
 * another model's output and price are the user's call.
 */
function createModelUnavailableError(
  provider: SystemProviderRef,
  verdict: Extract<HostedAiModelVerdict, { kind: "unavailable" }>,
): HostedAiProviderUnavailableError {
  const alternatives = verdict.alternatives
  return new HostedAiProviderUnavailableError(
    provider,
    getHostedAiModelUnavailableMessage(
      verdict.model?.name ?? provider.name,
      alternatives.map((model) => model.name),
    ),
    chooseHostedAiModelAction(alternatives[0]?.id ?? provider.model),
  )
}

/**
 * The model as the extension last knew it, when status could not say: the
 * stored list keeps cache identities stable through a status outage.
 */
async function findKnownHostedAiModel(
  verdict: HostedAiModelVerdict,
  modelId: string,
): Promise<HostedAiModel | undefined> {
  return verdict.kind === "usable"
    ? verdict.model
    : findHostedAiModel(await readStoredHostedAiModels(), modelId)
}

/**
 * `feature` is the hosted feature this provider will be billed against. It
 * decides which tier status gates the call, so it must be the feature the
 * caller actually runs — passing `pageTranslation` for a subtitle run would
 * gate on the wrong quota.
 *
 * The first overload preserves promptability through serialization: a caller
 * that already holds a promptable resolved ref gets a `PromptableProviderRef`
 * back without a runtime re-check.
 */
export async function serializeProviderRef(
  provider: ResolvedProviderRef<LLMProviderConfig>,
  route: HostedAiTextStreamRoute,
): Promise<PromptableProviderRef>
export async function serializeProviderRef(
  provider: ResolvedProviderRef<TranslateProviderConfig>,
  route: HostedAiTextStreamRoute,
): Promise<SerializableProviderRef>
export async function serializeProviderRef(
  provider: ResolvedProviderRef<TranslateProviderConfig>,
  route: HostedAiTextStreamRoute,
): Promise<SerializableProviderRef> {
  const feature = getHostedFeatureForRoute(route)
  if (provider.kind === "local") {
    return { kind: "local", config: provider.config }
  }

  const status = await fetchHostedAiStatus()
  const verdict = getHostedAiModelVerdict(status, feature, provider.model)

  if (verdict.kind === "blocked") {
    throw new HostedAiProviderUnavailableError(
      provider,
      getHostedAiTierDescription(verdict.tierStatus, {
        credit: getHostedAiCreditForFeature(status, feature),
      }) ?? i18n.t("hostedAi.availability.serviceUnavailable"),
    )
  }
  if (verdict.kind === "unavailable") {
    throw createModelUnavailableError(provider, verdict)
  }

  const languageDetection = feature === "languageDetection"
  const [model, choice] = await Promise.all([
    findKnownHostedAiModel(verdict, provider.model),
    languageDetection ? undefined : readHostedAiReasoningChoice(provider.model),
  ])

  return {
    kind: "system",
    providerId: provider.id,
    model: provider.model,
    modelTier: model?.tier ?? "normal",
    modelRevision: model?.modelRevision ?? UNKNOWN_MODEL_REVISION,
    reasoning: getRequestedHostedAiReasoning(model, choice, { languageDetection }) ?? null,
  }
}

export type ProviderAvailability<Ref extends SerializableProviderRef = SerializableProviderRef> =
  | { available: true; providerRef: Ref }
  | { available: false; message: string; action?: ErrorAction }

export async function checkProviderAvailability(
  provider: ResolvedProviderRef<LLMProviderConfig>,
  route: HostedAiTextStreamRoute,
): Promise<ProviderAvailability<PromptableProviderRef>>
export async function checkProviderAvailability(
  provider: ResolvedProviderRef<TranslateProviderConfig>,
  route: HostedAiTextStreamRoute,
): Promise<ProviderAvailability>
export async function checkProviderAvailability(
  provider: ResolvedProviderRef<TranslateProviderConfig>,
  route: HostedAiTextStreamRoute,
): Promise<ProviderAvailability> {
  try {
    return { available: true, providerRef: await serializeProviderRef(provider, route) }
  } catch (error) {
    if (error instanceof HostedAiProviderUnavailableError) {
      return { available: false, message: error.message, action: error.action }
    }
    throw error
  }
}
