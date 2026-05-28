import type { APIProviderConfig } from "@/types/config/provider"
import { i18n } from "#imports"
import { HelpTooltip } from "@/components/help-tooltip"
import { withForm } from "./form"

export const RequestTimeoutField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    return (
      <form.AppField name="requestTimeoutMs">
        {field => (
          <field.InputFieldAutoSave
            formForSubmit={form}
            label={(
              <div className="flex items-center gap-1.5">
                <span>{i18n.t("options.apiProviders.form.requestTimeout")}</span>
                <HelpTooltip>{i18n.t("options.apiProviders.form.requestTimeoutHint")}</HelpTooltip>
              </div>
            )}
            aria-label={i18n.t("options.apiProviders.form.requestTimeout")}
            type="number"
            min={1000}
            step={1000}
            placeholder="20000"
          />
        )}
      </form.AppField>
    )
  },
})
