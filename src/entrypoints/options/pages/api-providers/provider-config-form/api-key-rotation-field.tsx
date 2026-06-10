import type { APIProviderConfig } from "@/types/config/provider"
import { useStore } from "@tanstack/react-form"
import { SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/base-ui/select"
import { DEFAULT_API_KEY_COOLDOWN_SECONDS, DEFAULT_API_KEY_ROTATION_MODE } from "@/utils/providers/api-key-rotation"
import { withForm } from "./form"

export const APIKeyRotationField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useStore(form.store, state => state.values)

    if (providerConfig.provider === "ollama")
      return null

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form.AppField name="apiKeyRotationMode">
          {field => (
            <field.SelectFieldAutoSave
              formForSubmit={form}
              label="API key rotation"
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={DEFAULT_API_KEY_ROTATION_MODE} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="sequential">Sequential</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                </SelectGroup>
              </SelectContent>
            </field.SelectFieldAutoSave>
          )}
        </form.AppField>

        <form.AppField name="apiKeyCooldownSeconds">
          {field => (
            <field.InputFieldAutoSave
              formForSubmit={form}
              label="Key cooldown seconds"
              type="number"
              min={0}
              placeholder={String(DEFAULT_API_KEY_COOLDOWN_SECONDS)}
            />
          )}
        </form.AppField>
      </div>
    )
  },
})
