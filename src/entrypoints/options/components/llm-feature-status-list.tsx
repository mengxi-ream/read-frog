import type { FeatureKey } from "@/utils/constants/feature-providers"
import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { Link } from "react-router"
import { useHostedAiStatus } from "@/components/llm-providers/use-hosted-ai-status"
import { Button } from "@/components/ui/base-ui/button"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { FEATURE_PROVIDER_DEFS, getFeatureLabelI18nKey } from "@/utils/constants/feature-providers"
import { i18n } from "@/utils/i18n"
import { isProviderIdDurablyUnusable } from "@/utils/providers/provider-availability"
import { canResolvedProviderRefGenerateText } from "@/utils/providers/provider-ref"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"
import { cn } from "@/utils/styles/utils"
import { buildSectionLink } from "../command-palette/section-scroll"

/**
 * Per-feature "is this running on an LLM provider" status, with the way to go
 * fix it.
 *
 * Used by every setting that only works on a prompt-driven provider. Each
 * feature picks its own provider, so a single global verdict would be wrong — a
 * user can easily have a setting working on selection translation while page
 * translation quietly ignores it.
 *
 * The resolution is capability-based on purpose, and two comments' worth of
 * history are load-bearing:
 *   - Built-in AI is synthesized by the provider registry and is never a row in
 *     `providersConfig`, so looking the id up there reports it unconfigured
 *     forever.
 *   - `kind === "system"` answers "is it prompt-driven", not "does it run", so
 *     on its own it reported every feature configured for accounts whose plan
 *     funds none of them, signed-out guests included.
 *
 * Renders as `span`s so it can sit inside a `ConfigItem` description.
 */
export function LlmFeatureStatusList({
  featureKeys,
  className,
}: {
  featureKeys: readonly FeatureKey[]
  className?: string
}) {
  const config = useAtomValue(configAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const { status } = useHostedAiStatus()

  const statuses = useMemo(
    () =>
      featureKeys.map((featureKey) => {
        const providerId = FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config)
        const providerRef = resolveProviderRefForCapability(featureKey, providersConfig, providerId)
        const featureName = i18n.t(getFeatureLabelI18nKey(featureKey))
        const hasLLMProvider = providerRef
          ? canResolvedProviderRefGenerateText(providerRef) &&
            !isProviderIdDurablyUnusable(providerId, featureKey, status)
          : false

        return {
          featureKey,
          hasLLMProvider,
          text: hasLLMProvider
            ? i18n.t("options.apiProviders.aiContentAware.llmProviderConfigured", [featureName])
            : i18n.t("options.apiProviders.aiContentAware.llmProviderNotConfigured", [featureName]),
        }
      }),
    [config, providersConfig, status, featureKeys],
  )

  return (
    <span className={cn("mt-2 flex flex-col items-start gap-1", className)}>
      {statuses.map(({ featureKey, hasLLMProvider, text }) => (
        <span key={featureKey} className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              hasLLMProvider ? "bg-success" : "bg-warning",
            )}
          />
          <span className="text-[13px]">{text}</span>
        </span>
      ))}
      <Button
        size="xs"
        variant="outline"
        className="mt-1"
        render={<Link to={buildSectionLink("/api-providers", "feature-providers")} />}
      >
        {i18n.t("options.apiProviders.featureProviders.chooseProvider")}
      </Button>
    </span>
  )
}
