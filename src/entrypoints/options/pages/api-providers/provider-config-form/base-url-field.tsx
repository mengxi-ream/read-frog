import type { APIProviderConfig } from "@/types/config/provider"

import { useStore } from "@tanstack/react-form"
import { i18n } from "#imports"
import { isNonCustomLLMProvider } from "@/types/config/provider"
import { PROVIDER_BASE_URL_PLACEHOLDERS } from "@/utils/constants/providers"
import { ConnectionTestButton } from "./components/connection-button"
import { withForm } from "./form"

export const BaseURLField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useStore(form.store, state => state.values)
    const providerType = providerConfig.provider

    if (providerType === "deepl") {
      return null
    }

    const isOptionalBaseURL = isNonCustomLLMProvider(providerType)
    const labelText = `${i18n.t("options.apiProviders.form.fields.baseURL")}${isOptionalBaseURL
      ? ` (${i18n.t("options.apiProviders.form.fields.optional")})`
      : ""}`

    return (
      <form.AppField name="baseURL">
        {field => (
          <field.InputFieldAutoSave
            formForSubmit={form}
            label={labelText}
            placeholder={PROVIDER_BASE_URL_PLACEHOLDERS[providerType]}
            labelExtra={providerType === "ollama" && (
              <ConnectionTestButton
                providerConfig={providerConfig}
              />
            )}
          />
        )}
      </form.AppField>
    )
  },
})
