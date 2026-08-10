import type { ProviderConfigForCapability, SystemProviderRef } from "./provider-registry"
import type { Config } from "@/types/config/config"
import type { HostedAiStatus } from "@/utils/hosted-ai/types"
import {
  getHostedAiCreditForFeature,
  getHostedAiTierDescription,
  getHostedAiTierStatus,
} from "@/utils/hosted-ai/status"
import { orpcClient } from "@/utils/orpc/client"
import { resolveProviderRefForCapability } from "./provider-registry"

export type LocalTranslationProviderConfig = ProviderConfigForCapability<"pageTranslation">
export type PageTranslationProvider = LocalTranslationProviderConfig | SystemProviderRef

export type SerializablePageTranslationProvider =
  | { kind: "local"; config: LocalTranslationProviderConfig }
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

export function resolvePageTranslationProvider(config: Config): PageTranslationProvider {
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

export function resolvePageTranslationProviderOrNull(
  config: Config,
): PageTranslationProvider | null {
  try {
    return resolvePageTranslationProvider(config)
  } catch {
    return null
  }
}

export function isSystemTranslationProvider(
  provider: PageTranslationProvider,
): provider is SystemProviderRef {
  return "kind" in provider && provider.kind === "system"
}

export function getPageTranslationProviderId(provider: PageTranslationProvider): string {
  return isSystemTranslationProvider(provider) ? provider.id : provider.id
}

/**
 * Cache-identity fallback for a status-fetch failure. The translate endpoint
 * never sees this value. Entries cached under it during one outage can be
 * served during a later outage even across a real revision bump — accepted:
 * the overlap is rare and the alternative is failing the translation.
 */
const UNKNOWN_MODEL_REVISION = "unknown"

export async function serializePageTranslationProvider(
  provider: PageTranslationProvider,
): Promise<SerializablePageTranslationProvider> {
  if (!isSystemTranslationProvider(provider)) {
    return { kind: "local", config: provider }
  }

  // Fail open when the status endpoint itself is unreachable: the translate
  // endpoint enforces access on its own, so a status-only outage must not
  // block translation. Only an explicit server verdict blocks, below.
  let status: HostedAiStatus | undefined
  try {
    status = await orpcClient.hostedAi.status({})
  } catch {
    status = undefined
  }

  const tierStatus = getHostedAiTierStatus(status, "pageTranslation", provider.modelTier)
  if (tierStatus && !tierStatus.available) {
    throw new HostedAiProviderUnavailableError(
      provider,
      getHostedAiTierDescription(tierStatus, {
        credit: getHostedAiCreditForFeature(status, "pageTranslation"),
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

export type PageTranslationProviderAvailability =
  | { available: true; providerRef: SerializablePageTranslationProvider }
  | { available: false; message: string }

export async function checkPageTranslationProviderAvailability(
  provider: PageTranslationProvider,
): Promise<PageTranslationProviderAvailability> {
  try {
    return { available: true, providerRef: await serializePageTranslationProvider(provider) }
  } catch (error) {
    if (error instanceof HostedAiProviderUnavailableError) {
      return { available: false, message: error.message }
    }
    throw error
  }
}
