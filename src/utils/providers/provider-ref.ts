import type { SystemProviderRef } from "./provider-registry"
import type { HostedAiTextStreamRoute } from "@/types/background-stream"
import type { Config } from "@/types/config/config"
import type { TranslateProviderConfig } from "@/types/config/provider"
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
 * A resolved provider with the local wrapper stripped — either the local
 * config itself or the system ref. Callers unwrap `ResolvedProviderRef` into
 * this because most of them go on to inspect the config directly (`provider
 * !== "deeplx"`, `isLLMProviderConfig`) rather than the ref around it.
 *
 * `TranslateProviderConfig` is the wider of the registry's two capability
 * predicates (`LLMProviderConfig` is a subset of it), so every feature that
 * serializes a ref fits here, including the LLM-only ones. This type therefore
 * does not constrain which provider may run which feature — callers do, by
 * resolving through `resolveProviderRefForCapability` first.
 */
export type UnwrappedProviderRef = TranslateProviderConfig | SystemProviderRef

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

export class HostedAiProviderUnavailableError extends Error {
  constructor(
    readonly provider: SystemProviderRef,
    message: string,
  ) {
    super(message)
    this.name = "HostedAiProviderUnavailableError"
  }
}

export function resolvePageTranslationProvider(config: Config): UnwrappedProviderRef {
  const resolved = resolveProviderRefForCapability(
    "pageTranslation",
    config.providersConfig,
    config.pageTranslation.providerId,
  )
  if (!resolved) {
    throw new Error(`No page translation provider for id "${config.pageTranslation.providerId}"`)
  }
  return resolved.kind === "local" ? resolved.config : resolved
}

export function resolvePageTranslationProviderOrNull(config: Config): UnwrappedProviderRef | null {
  try {
    return resolvePageTranslationProvider(config)
  } catch {
    return null
  }
}

export function isSystemProviderRef(provider: UnwrappedProviderRef): provider is SystemProviderRef {
  return "kind" in provider && provider.kind === "system"
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
export function canProviderRefGenerateText(ref: SerializableProviderRef): boolean {
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
 */
export async function serializeProviderRef(
  provider: UnwrappedProviderRef,
  route: HostedAiTextStreamRoute,
): Promise<SerializableProviderRef> {
  const feature = getHostedFeatureForRoute(route)
  if (!isSystemProviderRef(provider)) {
    return { kind: "local", config: provider }
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

export type ProviderAvailability =
  | { available: true; providerRef: SerializableProviderRef }
  | { available: false; message: string }

export async function checkProviderAvailability(
  provider: UnwrappedProviderRef,
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
