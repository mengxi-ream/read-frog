import type { APIProviderConfig } from "@/types/config/provider"
import { useSelector } from "@tanstack/react-store"
import { useSetAtom } from "jotai"
import { Checkbox } from "@/components/ui/base-ui/checkbox"
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { toastManager } from "@/components/ui/base-ui/toast"
import {
  isCustomLLMProviderConfig,
  isLLMProviderConfig,
  LLM_PROVIDER_MODELS,
} from "@/types/config/provider"
import { providerConfigAtom, updateLLMProviderConfig } from "@/utils/atoms/provider"
import { i18n } from "@/utils/i18n"
import { resolveModelId } from "@/utils/providers/model-id"
import { ModelSuggestionButton } from "./components/model-suggestion-button"
import { ProviderOptionsRecommendationTrigger } from "./components/provider-options-recommendation-trigger"
import { withForm } from "./form"

export const TranslateModelSelector = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useSelector(form.store, (state) => state.values)
    const setProviderConfig = useSetAtom(providerConfigAtom(providerConfig.id))
    if (!isLLMProviderConfig(providerConfig)) return null

    const modelId = resolveModelId(providerConfig.model)
    const { isCustomModel, customModel, model } = providerConfig.model

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

    return (
      <div>
        {isCustomModel ? (
          <form.AppField name="model.customModel">
            {(field) => (
              <field.InputFieldAutoSave
                formForSubmit={form}
                label={i18n.t("options.general.translationConfig.model.title")}
                labelExtra={
                  <div className="flex items-center gap-2">
                    {recommendationTrigger}
                    {isCustomLLMProviderConfig(providerConfig) && (
                      <ModelSuggestionButton
                        baseURL={providerConfig.baseURL}
                        apiKey={providerConfig.apiKey}
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
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={i18n.t("options.apiProviders.form.models.translate.placeholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {LLM_PROVIDER_MODELS[providerConfig.provider].map((modelOption) => (
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
                  checked={field.state.value}
                  onCheckedChange={(checked) => {
                    try {
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
