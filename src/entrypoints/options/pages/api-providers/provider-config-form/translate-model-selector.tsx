import type { APIProviderConfig, LLMProviderConfig } from "@/types/config/provider"
import { useQuery } from "@tanstack/react-query"
import { useSelector } from "@tanstack/react-store"
import { useSetAtom } from "jotai"
import { useState } from "react"
import { Checkbox } from "@/components/ui/base-ui/checkbox"
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { toastManager } from "@/components/ui/base-ui/toast"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import {
  isCustomLLMProviderConfig,
  isLLMProviderConfig,
  LLM_PROVIDER_MODELS,
} from "@/types/config/provider"
import { providerConfigAtom, updateLLMProviderConfig } from "@/utils/atoms/provider"
import { Sha256Hex } from "@/utils/hash"
import { i18n } from "@/utils/i18n"
import { getModelDiscovery, MODEL_DISCOVERY_DESCRIPTORS } from "@/utils/providers/model-discovery"
import { resolveModelId } from "@/utils/providers/model-id"
import { ModelSuggestionButton } from "./components/model-suggestion-button"
import { ProviderOptionsRecommendationTrigger } from "./components/provider-options-recommendation-trigger"
import { withForm } from "./form"

export const TranslateModelSelector = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useSelector(form.store, (state) => state.values)
    const setProviderConfig = useSetAtom(providerConfigAtom(providerConfig.id))
    const [isManualModelEntry, setIsManualModelEntry] = useState(false)
    const isLLM = isLLMProviderConfig(providerConfig)
    const isCustomProvider = isLLM && isCustomLLMProviderConfig(providerConfig)
    const apiKey = isLLM && "apiKey" in providerConfig ? providerConfig.apiKey?.trim() : undefined
    const baseURL =
      isLLM && "baseURL" in providerConfig ? providerConfig.baseURL?.trim() : undefined
    const debouncedAPIKey = useDebouncedValue(apiKey, 500)
    const debouncedBaseURL = useDebouncedValue(baseURL, 500)
    const discoveryProviderConfig = isLLM
      ? {
          ...providerConfig,
          ...("apiKey" in providerConfig ? { apiKey: debouncedAPIKey } : {}),
          ...("baseURL" in providerConfig ? { baseURL: debouncedBaseURL } : {}),
        }
      : undefined
    const modelDiscovery = discoveryProviderConfig
      ? getModelDiscovery(discoveryProviderConfig)
      : undefined
    // openai-compatible stays on the manual custom-model path; every other provider
    // with a discovery source gets the automatic dropdown.
    const supportsAutomaticModelDiscovery =
      isLLM &&
      providerConfig.provider !== "openai-compatible" &&
      (isCustomProvider || MODEL_DISCOVERY_DESCRIPTORS[providerConfig.provider] !== undefined)
    const apiKeyHash = debouncedAPIKey ? Sha256Hex(debouncedAPIKey) : ""
    const autoDiscoverModels = supportsAutomaticModelDiscovery && modelDiscovery !== undefined
    const { data: discoveredModels = [] } = useQuery({
      queryKey: ["providerModels", providerConfig.id, modelDiscovery?.endpoint, apiKeyHash],
      queryFn: ({ signal }) => modelDiscovery!.fetchModels(signal),
      enabled: autoDiscoverModels,
      retry: false,
      staleTime: 5 * 60 * 1000,
      meta: { suppressToast: true },
    })

    if (!isLLMProviderConfig(providerConfig)) return null

    const modelId = resolveModelId(providerConfig.model)
    const { isCustomModel, customModel, model } = providerConfig.model
    const availableModelOptions = [
      ...new Set([...LLM_PROVIDER_MODELS[providerConfig.provider], ...discoveredModels]),
    ]
    const modelOptions =
      modelId && !availableModelOptions.includes(modelId)
        ? [modelId, ...availableModelOptions]
        : availableModelOptions
    const showCustomModelInput =
      providerConfig.provider === "openai-compatible" ||
      (supportsAutomaticModelDiscovery ? isManualModelEntry : isCustomModel)

    const applyRecommendedProviderOptions = (options: Record<string, unknown>) => {
      form.setFieldValue("providerOptions", options)
      void form.handleSubmit()
    }

    const recommendationTrigger = (
      <ProviderOptionsRecommendationTrigger
        providerId={providerConfig.id}
        modelId={modelId}
        currentProviderOptions={providerConfig.providerOptions}
        onApply={applyRecommendedProviderOptions}
      />
    )

    const handleModelChange = (selectedModel: string) => {
      const knownModels: readonly string[] = LLM_PROVIDER_MODELS[providerConfig.provider]
      if (knownModels.includes(selectedModel)) {
        // The includes() check proves the id belongs to this provider's model enum.
        form.setFieldValue("model.model", selectedModel as LLMProviderConfig["model"]["model"])
        form.setFieldValue("model.isCustomModel", false)
        form.setFieldValue("model.customModel", null)
      } else {
        form.setFieldValue("model.isCustomModel", true)
        form.setFieldValue("model.customModel", selectedModel)
      }
      void form.handleSubmit()
    }

    return (
      <div>
        {showCustomModelInput ? (
          <form.AppField name="model.customModel">
            {(field) => (
              <field.InputFieldAutoSave
                formForSubmit={form}
                label={i18n.t("options.general.translationConfig.model.title")}
                labelExtra={
                  <div className="flex items-center gap-2">
                    {recommendationTrigger}
                    {isCustomLLMProviderConfig(providerConfig) && modelDiscovery && (
                      <ModelSuggestionButton
                        providerId={providerConfig.id}
                        endpoint={modelDiscovery.endpoint}
                        fetchModels={modelDiscovery.fetchModels}
                        onSelect={(selectedModel) => {
                          field.handleChange(selectedModel)
                          void form.handleSubmit()
                        }}
                      />
                    )}
                  </div>
                }
                value={customModel ?? ""}
              />
            )}
          </form.AppField>
        ) : (
          <form.AppField name="model.model">
            {(field) => (
              <field.SelectFieldAutoSave
                formForSubmit={form}
                label={i18n.t("options.general.translationConfig.model.title")}
                labelExtra={recommendationTrigger}
                value={modelId}
                onValueChange={(selectedModel) => {
                  if (typeof selectedModel === "string") {
                    handleModelChange(selectedModel)
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={i18n.t("options.apiProviders.form.models.translate.placeholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {modelOptions.map((modelOption) => (
                      <SelectItem key={modelOption} value={modelOption}>
                        {modelOption}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </field.SelectFieldAutoSave>
            )}
          </form.AppField>
        )}
        {providerConfig.provider !== "openai-compatible" && (
          <form.Field name="model.isCustomModel">
            {(field) => (
              <div className="mt-2.5 flex items-center space-x-2">
                <Checkbox
                  id="isCustomModel-translate"
                  checked={supportsAutomaticModelDiscovery ? isManualModelEntry : field.state.value}
                  onCheckedChange={(checked) => {
                    try {
                      if (supportsAutomaticModelDiscovery) {
                        setIsManualModelEntry(checked)
                        if (checked && !providerConfig.model.isCustomModel) {
                          form.setFieldValue("model.isCustomModel", true)
                          form.setFieldValue("model.customModel", modelId ?? model)
                          void form.handleSubmit()
                        } else if (!checked && !modelId) {
                          form.setFieldValue("model.isCustomModel", false)
                          form.setFieldValue("model.customModel", null)
                          void form.handleSubmit()
                        }
                        return
                      }

                      if (!checked) {
                        void setProviderConfig(
                          updateLLMProviderConfig(providerConfig, {
                            model: {
                              customModel: null,
                              isCustomModel: false,
                            },
                          }),
                        )
                      } else if (checked) {
                        void setProviderConfig(
                          updateLLMProviderConfig(providerConfig, {
                            model: {
                              customModel: model,
                              isCustomModel: true,
                            },
                          }),
                        )
                      }
                    } catch (error) {
                      toastManager.add({
                        type: "error",
                        title:
                          error instanceof Error ? error.message : "Failed to update configuration",
                      })
                    }
                  }}
                />
                <label
                  htmlFor="isCustomModel-translate"
                  className="cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {i18n.t("options.general.translationConfig.model.enterCustomModel")}
                </label>
              </div>
            )}
          </form.Field>
        )}
      </div>
    )
  },
})
