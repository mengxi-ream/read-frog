import type { APIProviderConfig } from "@/types/config/provider"
import { useSelector } from "@tanstack/react-store"
import { HelpTooltip } from "@/components/help-tooltip"
import { isLLMProviderConfig } from "@/types/config/provider"
import { i18n } from "@/utils/i18n"
import { withForm } from "./form"

export const TemperatureField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useSelector(form.store, state => state.values)
    const isLLMProvider = isLLMProviderConfig(providerConfig)

    if (!isLLMProvider) {
      return null
    }

    return (
      <form.AppField name="temperature">
        {field => (
          <field.InputFieldAutoSave
            formForSubmit={form}
            label={(
              <div className="flex items-center gap-1.5">
                <span>{i18n.t("options.apiProviders.form.temperature")}</span>
                <HelpTooltip>{i18n.t("options.apiProviders.form.temperatureHint")}</HelpTooltip>
              </div>
            )}
            type="number"
            min={0}
            step={0.01}
          />
        )}
      </form.AppField>
    )
  },
})
