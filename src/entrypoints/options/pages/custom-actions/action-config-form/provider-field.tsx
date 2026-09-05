import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { useAutosaveContext } from "@/components/form/use-autosave"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { useHostedAiProviderOptions } from "@/components/llm-providers/use-hosted-ai-provider-options"
import { Field, FieldTitle } from "@/components/ui/base-ui/field"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import {
  getProviderIdsForCapability,
  getSelectableProvidersForCapability,
} from "@/utils/providers/provider-registry"
import { withForm } from "./form"

export const ProviderField = withForm({
  ...{ defaultValues: {} as SelectionToolbarCustomAction },
  render: function Render({ form }) {
    const autosave = useAutosaveContext()
    const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

    const baseCustomActionProviders = useMemo(
      () => getSelectableProvidersForCapability("customAction", providersConfig),
      [providersConfig],
    )
    const customActionProviders = useHostedAiProviderOptions(
      "customAction",
      baseCustomActionProviders,
    )
    const customActionProviderIds = useMemo(
      () =>
        getProviderIdsForCapability("customAction", providersConfig, {
          requireEnable: true,
        }),
      [providersConfig],
    )

    return (
      <form.AppField
        name="providerId"
        validators={{
          onChange: ({ value }) => {
            if (!customActionProviderIds.includes(value)) {
              return i18n.t("options.selectionToolbar.customActions.errors.providerRequired")
            }
            return undefined
          },
        }}
      >
        {(field) => (
          <Field>
            <FieldTitle>
              {i18n.t("options.selectionToolbar.customActions.form.provider")}
            </FieldTitle>
            <ProviderSelector
              providers={customActionProviders}
              value={field.state.value}
              onChange={(id) => {
                autosave.edit(() => field.handleChange(id), { immediate: true })
              }}
              placeholder={i18n.t("options.selectionToolbar.customActions.form.selectProvider")}
            />
            {field.state.meta.errors.length > 0 && (
              <span className="text-sm font-normal text-destructive">
                {field.state.meta.errors.join(", ")}
              </span>
            )}
          </Field>
        )}
      </form.AppField>
    )
  },
})
