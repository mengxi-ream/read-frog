import type { APIProviderConfig } from "@/types/config/provider"
import { useSelector } from "@tanstack/react-store"
import { useAutosaveContext } from "@/components/form/use-autosave"
import { Checkbox } from "@/components/ui/base-ui/checkbox"
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import {
  isCustomModelOnlyProvider,
  isLLMProviderConfig,
  isProtocolCompatibleLLMProviderConfig,
  LLM_PROVIDER_MODELS,
} from "@/types/config/provider"
import { i18n } from "@/utils/i18n"
import { resolveModelId } from "@/utils/providers/model-id"
import { ModelSuggestionButton } from "./components/model-suggestion-button"
import { ProviderOptionsRecommendationTrigger } from "./components/provider-options-recommendation-trigger"
import { withForm } from "./form"

export const TranslateModelSelector = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useSelector(form.store, (state) => state.values)
    const autosave = useAutosaveContext()
    if (!isLLMProviderConfig(providerConfig)) return null

    const modelId = resolveModelId(providerConfig.model)
    const { isCustomModel, customModel, model } = providerConfig.model

    const applyRecommendedProviderOptions = (options: Record<string, unknown>) => {
      autosave.edit(() => form.setFieldValue("providerOptions", options), { immediate: true })
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
                label={i18n.t("options.apiProviders.form.models.label")}
                labelExtra={
                  <div className="flex items-center gap-2">
                    {recommendationTrigger}
                    {isProtocolCompatibleLLMProviderConfig(providerConfig) && (
                      <ModelSuggestionButton
                        providerConfig={providerConfig}
                        onSelect={(selectedModel) => {
                          autosave.edit(() => field.handleChange(selectedModel), {
                            immediate: true,
                          })
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
                label={i18n.t("options.apiProviders.form.models.label")}
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
        {!isCustomModelOnlyProvider(providerConfig.provider) && (
          <form.Field name="model.isCustomModel">
            {(field) => (
              <div className="mt-2.5 flex items-center space-x-2">
                <Checkbox
                  id="isCustomModel-translate"
                  checked={field.state.value}
                  onCheckedChange={(checked) => {
                    autosave.edit(
                      () => {
                        form.setFieldValue("model.isCustomModel", checked)
                        form.setFieldValue("model.customModel", checked ? model : null)
                      },
                      { immediate: true },
                    )
                  }}
                />
                <label
                  htmlFor="isCustomModel-translate"
                  className="cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {i18n.t("options.apiProviders.form.models.enterCustomModel")}
                </label>
              </div>
            )}
          </form.Field>
        )}
      </div>
    )
  },
})
