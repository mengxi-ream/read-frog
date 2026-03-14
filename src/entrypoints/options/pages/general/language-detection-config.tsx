import { i18n } from "#imports"
import { useAtom, useAtomValue } from "jotai"
import { useMemo } from "react"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/base-ui/field"
import { Label } from "@/components/ui/base-ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/base-ui/radio-group"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getEnabledLLMProvidersConfig, resolveLanguageDetectionConfigForModeChange } from "@/utils/config/helpers"
import { ConfigCard } from "../../components/config-card"

export default function LanguageDetectionConfig() {
  const [languageDetection, setLanguageDetection] = useAtom(configFieldsAtomMap.languageDetection)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const enabledLLMProviders = useMemo(
    () => getEnabledLLMProvidersConfig(providersConfig),
    [providersConfig],
  )

  const hasLLMProviders = enabledLLMProviders.length > 0
  const isLLMMode = languageDetection.mode === "llm"

  const statusIndicator = useMemo(() => {
    if (!hasLLMProviders) {
      return { color: "bg-orange-400", text: i18n.t("options.general.languageDetection.status.noProviders") }
    }
    if (!isLLMMode) {
      return { color: "bg-blue-400", text: i18n.t("options.general.languageDetection.status.basicRecommend") }
    }
    return { color: "bg-green-500", text: i18n.t("options.general.languageDetection.status.llmEnabled") }
  }, [hasLLMProviders, isLLMMode])

  return (
    <ConfigCard
      id="language-detection"
      title={i18n.t("options.general.languageDetection.title")}
      description={(
        <>
          {i18n.t("options.general.languageDetection.description")}
          <div className="flex items-center gap-1.5 mt-2">
            <div className={`size-2 rounded-full ${statusIndicator.color}`} />
            <span className="text-xs">{statusIndicator.text}</span>
          </div>
        </>
      )}
    >
      <FieldGroup>
        <RadioGroup
          value={languageDetection.mode}
          onValueChange={(value: string) => {
            if (value !== "basic" && value !== "llm")
              return

            const nextConfig = resolveLanguageDetectionConfigForModeChange(
              languageDetection,
              value,
              providersConfig,
            )

            if (!nextConfig)
              return

            void setLanguageDetection(nextConfig)
          }}
          className="flex flex-row gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="basic" id="lang-detection-basic" />
            <Label htmlFor="lang-detection-basic">{i18n.t("options.general.languageDetection.mode.basic")}</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="llm" id="lang-detection-llm" disabled={!hasLLMProviders} />
            <Label htmlFor="lang-detection-llm">{i18n.t("options.general.languageDetection.mode.llm")}</Label>
          </div>
        </RadioGroup>

        {isLLMMode && (
          <Field>
            <FieldLabel nativeLabel={false} render={<div />}>
              {i18n.t("options.general.languageDetection.provider.label")}
            </FieldLabel>
            <ProviderSelector
              providers={enabledLLMProviders}
              value={languageDetection.providerId ?? ""}
              onChange={providerId => void setLanguageDetection({ providerId })}
              placeholder={i18n.t("options.general.languageDetection.provider.placeholder")}
              className="w-full"
            />
          </Field>
        )}
      </FieldGroup>
    </ConfigCard>
  )
}
