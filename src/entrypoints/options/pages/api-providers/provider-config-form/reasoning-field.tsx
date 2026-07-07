import type { APIProviderConfig } from "@/types/config/provider"
import { useSelector } from "@tanstack/react-store"
import { SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/base-ui/select"
import { AI_SDK_REASONING_VALUES, isLLMProviderConfig, supportsTopLevelReasoning } from "@/types/config/provider"
import { i18n } from "@/utils/i18n"
import { withForm } from "./form"

export const ReasoningField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useSelector(form.store, state => state.values)

    if (!isLLMProviderConfig(providerConfig) || !supportsTopLevelReasoning(providerConfig.provider)) {
      return null
    }

    return (
      <form.AppField name="reasoning">
        {field => (
          <field.SelectFieldAutoSave
            formForSubmit={form}
            label={i18n.t("options.apiProviders.form.reasoning.title")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="provider-default" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {AI_SDK_REASONING_VALUES.map(reasoning => (
                  <SelectItem key={reasoning} value={reasoning}>
                    {reasoning}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </field.SelectFieldAutoSave>
        )}
      </form.AppField>
    )
  },
})
