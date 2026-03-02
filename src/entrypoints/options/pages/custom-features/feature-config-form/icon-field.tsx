import type { SelectionToolbarCustomFeature } from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useStore } from "@tanstack/react-form"
import { Field, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import { ICON_PATTERN } from "@/utils/constants/selection-toolbar-custom-feature"
import { withForm } from "./form"

export const IconField = withForm({
  ...{ defaultValues: {} as SelectionToolbarCustomFeature },
  render: function Render({ form }) {
    const iconValue = useStore(form.store, state => state.values.icon)

    return (
      <form.AppField
        name="icon"
        validators={{
          onChange: ({ value }) => {
            if (!ICON_PATTERN.test(value.trim())) {
              return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.errors.invalidIcon")
            }
            return undefined
          },
        }}
      >
        {field => (
          <Field>
            <div className="flex items-end justify-between w-full">
              <FieldLabel nativeLabel={false} render={<div />}>
                Icon
              </FieldLabel>
              <a href="https://icon-sets.iconify.design/" className="text-xs text-link hover:opacity-90" target="_blank" rel="noreferrer">
                Find more icons
              </a>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-8 shadow-xs shrink-0 rounded-md border flex items-center justify-center text-zinc-600 dark:text-zinc-300">
                {iconValue && <Icon icon={iconValue} className="size-4" />}
              </div>
              <Input
                value={field.state.value ?? ""}
                placeholder="tabler:sparkles"
                aria-invalid={field.state.meta.errors.length > 0}
                onBlur={field.handleBlur}
                onChange={(e) => {
                  field.handleChange(e.target.value)
                  void form.handleSubmit()
                }}
              />
            </div>
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
