import type { APIProviderConfig } from "@/types/config/provider"
import { useSelector } from "@tanstack/react-store"
import { useState } from "react"
import { Checkbox } from "@/components/ui/base-ui/checkbox"
import { i18n } from "@/utils/i18n"
import { ConnectionTestButton } from "./components/connection-button"
import { withForm } from "./form"

export const APIKeyField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    // const providerConfig = form.state.values
    const [showAPIKey, setShowAPIKey] = useState(false)
    const providerConfig = useSelector(form.store, state => state.values)

    const providerType = providerConfig.provider
    if (providerType === "ollama") {
      return <></>
    }

    return (
      <form.AppField name="apiKey">
        {field => (
          <div className="flex flex-col gap-2">
            <field.InputFieldAutoSave
              formForSubmit={form}
              label="API Key"
              labelExtra={(
                <ConnectionTestButton
                  providerConfig={providerConfig}
                />
              )}
              type={showAPIKey ? "text" : "password"}
            />
            <div className="mt-0.5 flex items-center space-x-2">
              <Checkbox
                id={`apiKey-${providerConfig.id}`}
                checked={showAPIKey}
                onCheckedChange={checked => setShowAPIKey(checked === true)}
              />
              <label
                htmlFor={`apiKey-${providerConfig.id}`}
                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {i18n.t("options.apiProviders.apiKey.showAPIKey")}
              </label>
            </div>
          </div>
        )}
      </form.AppField>
    )
  },
})
