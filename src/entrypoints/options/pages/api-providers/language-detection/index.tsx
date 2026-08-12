import { useAtom, useAtomValue } from "jotai"
import { useMemo } from "react"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { useHostedAiProviderOptions } from "@/components/llm-providers/use-hosted-ai-provider-options"
import { useHostedAiStatus } from "@/components/llm-providers/use-hosted-ai-status"
import { Label } from "@/components/ui/base-ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/base-ui/radio-group"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { resolveLanguageDetectionConfigForModeChange } from "@/utils/config/helpers"
import { i18n } from "@/utils/i18n"
import { isProviderSelectorItem } from "@/utils/providers/provider-display"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { SELECT_CONTENT_PROPS } from "../../../components/select-content-props"

export function LanguageDetectionConfig() {
  const [languageDetection, setLanguageDetection] = useAtom(configFieldsAtomMap.languageDetection)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  // Capability-based so Built-in AI appears: it is synthesized by the provider
  // registry rather than stored in providersConfig, so the old
  // getEnabledLLMProvidersConfig filter could never surface it.
  const selectableProviders = useMemo(
    () => getSelectableProvidersForCapability("languageDetection", providersConfig),
    [providersConfig],
  )
  // Adds the Ultra badge and grays out tiers this account cannot run, matching
  // every other provider dropdown.
  const providerOptions = useHostedAiProviderOptions("languageDetection", selectableProviders)
  const { status } = useHostedAiStatus()

  // Usable, not merely present. Built-in AI is in every capability list, so a
  // length check here was always true and painted a green "LLM detection
  // enabled" dot for accounts whose plan does not fund hosted detection —
  // over a code path that returns null on every call and falls back to franc.
  const hasProviders = providerOptions.some(
    (option) => isProviderSelectorItem(option) && !option.disabled,
  )
  const isLLMMode = languageDetection.mode === "llm"

  const statusIndicator = useMemo(() => {
    if (!hasProviders) {
      return {
        color: "bg-orange-400",
        text: i18n.t("options.apiProviders.languageDetection.status.noProviders"),
      }
    }
    if (!isLLMMode) {
      return {
        color: "bg-blue-400",
        text: i18n.t("options.apiProviders.languageDetection.status.basicRecommend"),
      }
    }
    return {
      color: "bg-green-500",
      text: i18n.t("options.apiProviders.languageDetection.status.llmEnabled"),
    }
  }, [hasProviders, isLLMMode])

  return (
    <ConfigSection
      id="language-detection"
      title={i18n.t("options.apiProviders.languageDetection.title")}
    >
      <ConfigItem
        title={i18n.t("options.apiProviders.languageDetection.provider.label")}
        description={
          <>
            {i18n.t("options.apiProviders.languageDetection.description")}
            <span className="mt-2 flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${statusIndicator.color}`} />
              <span className="text-xs">{statusIndicator.text}</span>
            </span>
          </>
        }
      >
        <div className="flex flex-col items-end gap-3">
          <RadioGroup
            value={languageDetection.mode}
            onValueChange={(value: string) => {
              if (value !== "basic" && value !== "llm") return

              const nextConfig = resolveLanguageDetectionConfigForModeChange(
                languageDetection,
                value,
                providersConfig,
                status,
              )

              // No provider can run LLM detection for this account, so arming
              // the mode would only produce an inert setting.
              if (!nextConfig) return

              void setLanguageDetection(nextConfig)
            }}
            className="flex flex-row gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="basic" id="lang-detection-basic" />
              <Label htmlFor="lang-detection-basic">
                {i18n.t("options.apiProviders.languageDetection.mode.basic")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="llm" id="lang-detection-llm" disabled={!hasProviders} />
              <Label htmlFor="lang-detection-llm">
                {i18n.t("options.apiProviders.languageDetection.mode.llm")}
              </Label>
            </div>
          </RadioGroup>

          {isLLMMode && (
            <ProviderSelector
              providers={providerOptions}
              value={languageDetection.providerId ?? ""}
              onChange={(providerId) => void setLanguageDetection({ providerId })}
              placeholder={i18n.t("options.apiProviders.languageDetection.provider.placeholder")}
              triggerSize="sm"
              selectContentProps={SELECT_CONTENT_PROPS}
            />
          )}
        </div>
      </ConfigItem>
    </ConfigSection>
  )
}
