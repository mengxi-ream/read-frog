import type { SelectionToolbarCustomFeature } from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { useAtomValue } from "jotai"
import { useMemo } from "react"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { Field, FieldLabel } from "@/components/ui/base-ui/field"
import { isLLMProviderConfig } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { filterEnabledProvidersConfig } from "@/utils/config/helpers"
import { withForm } from "./form"

export const ProviderField = withForm({
  ...{ defaultValues: {} as SelectionToolbarCustomFeature },
  render: function Render({ form }) {
    const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

    const llmProviders = useMemo(
      () => filterEnabledProvidersConfig(providersConfig).filter(isLLMProviderConfig),
      [providersConfig],
    )
    const llmProviderIds = useMemo(
      () => llmProviders.map(p => p.id),
      [llmProviders],
    )

    return (
      <form.AppField
        name="providerId"
        validators={{
          onChange: ({ value }) => {
            if (!llmProviderIds.includes(value)) {
              return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.errors.providerRequired")
            }
            return undefined
          },
        }}
      >
        {field => (
          <Field>
            <FieldLabel nativeLabel={false} render={<div />}>
              {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.provider")}
            </FieldLabel>
            <ProviderSelector
              providers={llmProviders}
              value={field.state.value}
              onChange={(id) => {
                field.handleChange(id)
                void form.handleSubmit()
              }}
              placeholder={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.selectProvider")}
            />
            {field.state.meta.errors.length > 0 && (
              <span className="text-sm font-normal text-destructive">
                {field.state.meta.errors.map(error => typeof error === "string" ? error : error?.message).join(", ")}
              </span>
            )}
          </Field>
        )}
      </form.AppField>
    )
  },
})
