import type { ProviderConfigForCapability, SystemProviderRef } from "./provider-registry"
import type { Config } from "@/types/config/config"
import {
  getHostedAiCreditForFeature,
  getHostedAiStatus,
  getHostedAiTierDescription,
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

export async function serializePageTranslationProvider(
  provider: PageTranslationProvider,
): Promise<SerializablePageTranslationProvider> {
  if (!isSystemTranslationProvider(provider)) {
    return { kind: "local", config: provider }
  }

  const status = await getHostedAiStatus(orpcClient)
  const tierStatus = status.features.pageTranslation[provider.modelTier]
  if (!tierStatus.available) {
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
    modelRevision: tierStatus.modelRevision,
  }
}

export async function checkPageTranslationProviderAvailability(
  provider: PageTranslationProvider,
): Promise<{ available: true } | { available: false; message: string }> {
  if (!isSystemTranslationProvider(provider)) return { available: true }

  try {
    const status = await getHostedAiStatus(orpcClient, { force: true })
    const tierStatus = status.features.pageTranslation[provider.modelTier]
    if (tierStatus.available) return { available: true }
    return {
      available: false,
      message:
        getHostedAiTierDescription(tierStatus, {
          credit: getHostedAiCreditForFeature(status, "pageTranslation"),
        }) ?? "Built-in AI is unavailable",
    }
  } catch {
    return {
      available: false,
      message: getHostedAiTierDescription(undefined) ?? "Built-in AI is unavailable",
    }
  }
}
