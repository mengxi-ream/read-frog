import type { ResolvedProviderRef, SystemProviderRef } from "./provider-registry"
import type { HostedAiTextStreamRoute } from "@/types/background-stream"
import type { Config } from "@/types/config/config"
import type { LLMProviderConfig, TranslateProviderConfig } from "@/types/config/provider"
import type { HostedAiFeature, HostedAiStatus } from "@/utils/hosted-ai/types"
import { isLLMProviderConfig } from "@/types/config/provider"
import {
  getHostedAiCreditForFeature,
  getHostedAiTierDescription,
  getHostedAiTierStatus,
} from "@/utils/hosted-ai/status"
import { sendMessage } from "@/utils/message"
import { resolveProviderRefForCapability } from "./provider-registry"

/**
 * A provider flattened for structured-clone transport to the background. Local
 * providers carry their whole config; system providers carry only what the
 * hosted call and the cache key need — the tier to bill and the model revision
 * that identifies the output.
 */
export type SerializableProviderRef =
  | { kind: "local"; config: TranslateProviderConfig }
  | {
      kind: "system"
      providerId: SystemProviderRef["id"]
      modelTier: SystemProviderRef["modelTier"]
      modelRevision: string
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
  | Extract<SerializableProviderRef, { kind: "system" }>

export class HostedAiProviderUnavailableError extends Error {
  constructor(
    readonly provider: SystemProviderRef,
    message: string,
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
 * changed key or temperature invalidates; system providers hash the tier's
 * model revision, which is exactly what the server bumps when output changes.
 * One helper so every cache (page, subtitles, summaries, segmentation) keys
 * the same way — a local ref still stringifies byte-identically to what those
 * caches used before, so existing BYOK entries survive.
 */
export function getProviderCacheIdentity(ref: SerializableProviderRef): string {
  return ref.kind === "local"
    ? JSON.stringify(ref.config)
    : JSON.stringify({ providerId: ref.providerId, modelRevision: ref.modelRevision })
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

  const tierStatus = getHostedAiTierStatus(status, feature, provider.modelTier)
  if (tierStatus && !tierStatus.available) {
    throw new HostedAiProviderUnavailableError(
      provider,
      getHostedAiTierDescription(tierStatus, {
        credit: getHostedAiCreditForFeature(status, feature),
      }) ?? "Built-in AI is unavailable",
    )
  }

  return {
    kind: "system",
    providerId: provider.id,
    modelTier: provider.modelTier,
    modelRevision: tierStatus?.modelRevision ?? UNKNOWN_MODEL_REVISION,
  }
}

export type ProviderAvailability<Ref extends SerializableProviderRef = SerializableProviderRef> =
  | { available: true; providerRef: Ref }
  | { available: false; message: string }

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
      return { available: false, message: error.message }
    }
    throw error
  }
}
