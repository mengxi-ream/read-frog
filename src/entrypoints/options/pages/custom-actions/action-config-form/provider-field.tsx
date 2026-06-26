import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { useAtomValue } from "jotai"
import { useMemo } from "react"
import { i18n } from "#imports"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { Field, FieldLabel } from "@/components/ui/base-ui/field"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  getProviderIdsForCapability,
  getSelectableProvidersForCapability,
} from "@/utils/providers/provider-registry"
import { withForm } from "./form"

export const ProviderField = withForm({
  ...{ defaultValues: {} as SelectionToolbarCustomAction },
  render: function Render({ form }) {
    const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

    const customActionProviders = useMemo(
      () => getSelectableProvidersForCapability("selectionToolbar.customAction", providersConfig),
      [providersConfig],
    )
    const customActionProviderIds = useMemo(
      () => getProviderIdsForCapability("selectionToolbar.customAction", providersConfig, { requireEnable: true }),
      [providersConfig],
    )

    return (
      <form.AppField
        name="providerId"
        validators={{
          onChange: ({ value }) => {
            if (!customActionProviderIds.includes(value)) {
              return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.errors.providerRequired")
            }
            return undefined
          },
        }}
      >
        {field => (
          <Field>
            <FieldLabel nativeLabel={false} render={<div />}>
              {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.provider")}
            </FieldLabel>
            <ProviderSelector
              providers={customActionProviders}
              value={field.state.value}
              onChange={(id) => {
                field.handleChange(id)
                void form.handleSubmit()
              }}
              placeholder={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.selectProvider")}
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
