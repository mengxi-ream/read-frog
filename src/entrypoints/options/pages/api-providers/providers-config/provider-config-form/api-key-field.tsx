import type { APIProviderConfig } from "@/types/config/provider"
import { useSelector } from "@tanstack/react-store"
import { useAtom } from "jotai"
import { useEffect, useState } from "react"
import { Checkbox } from "@/components/ui/base-ui/checkbox"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { highlightedProviderFieldAtom, PROVIDER_FIELD_HIGHLIGHT_DURATION_MS } from "../atoms"
import { ConnectionTestButton } from "./components/connection-button"
import { withForm } from "./form"

export const APIKeyField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    // const providerConfig = form.state.values
    const [showAPIKey, setShowAPIKey] = useState(false)
    const providerConfig = useSelector(form.store, (state) => state.values)
    const [highlightedField, setHighlightedField] = useAtom(highlightedProviderFieldAtom)
    const isHighlighted = highlightedField === "apiKey"

    // Clears itself so switching providers afterwards does not flash their key field too.
    useEffect(() => {
      if (!isHighlighted) return undefined

      const timeout = setTimeout(
        () => setHighlightedField(null),
        PROVIDER_FIELD_HIGHLIGHT_DURATION_MS,
      )
      return () => clearTimeout(timeout)
    }, [isHighlighted, setHighlightedField])

    const providerType = providerConfig.provider
    if (providerType === "ollama") {
      return <></>
    }

    return (
      <form.AppField name="apiKey">
        {(field) => (
          <div className="flex flex-col gap-2">
            <field.InputFieldAutoSave
              formForSubmit={form}
              label="API Key"
              labelExtra={<ConnectionTestButton providerConfig={providerConfig} />}
              type={showAPIKey ? "text" : "password"}
              className={cn(isHighlighted && "animate-ring-flash")}
            />
            <div className="mt-0.5 flex items-center space-x-2">
              <Checkbox
                id={`apiKey-${providerConfig.id}`}
                checked={showAPIKey}
                onCheckedChange={(checked) => setShowAPIKey(checked)}
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
