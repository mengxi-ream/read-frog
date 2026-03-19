import type { APIProviderConfig, LLMProviderTypes } from "@/types/config/provider"
import type { ConnectionOptionFieldDef } from "@/utils/constants/providers"
import { i18n } from "#imports"
import { useStore } from "@tanstack/react-form"
import { useEffect, useEffectEvent, useMemo, useState } from "react"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { isLLMProvider } from "@/types/config/provider"
import { compactObject } from "@/types/utils"
import { PROVIDER_CONNECTION_OPTIONS_FIELDS } from "@/utils/constants/providers"
import { withForm } from "./form"

export const ConnectionOptionsField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useStore(form.store, state => state.values)
    const providerType = providerConfig.provider
    const [localOptions, setLocalOptions] = useState(
      () => providerConfig.connectionOptions ?? {},
    )

    // Sync local state when switching provider
    const syncLocalOptions = useEffectEvent(() => {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setLocalOptions(providerConfig.connectionOptions ?? {})
    })

    useEffect(() => {
      syncLocalOptions()
    }, [providerConfig.id])

    const debouncedOptions = useDebouncedValue(localOptions, 500)

    // Submit when debounced value changes
    useEffect(() => {
      const compacted = compactObject(debouncedOptions)
      form.setFieldValue(
        "connectionOptions",
        Object.keys(compacted).length > 0 ? compacted : undefined,
      )
      void form.handleSubmit()
    }, [debouncedOptions, form])

    const fieldDefs = useMemo(() => {
      if (!isLLMProvider(providerType))
        return null
      const defs = PROVIDER_CONNECTION_OPTIONS_FIELDS[providerType as LLMProviderTypes]
      return defs && defs.length > 0 ? defs : null
    }, [providerType])

    if (!fieldDefs)
      return null

    const renderField = (def: ConnectionOptionFieldDef) => {
      const fieldId = `${def.key}-${providerConfig.id}`
      const fieldLabel = i18n.t(`options.apiProviders.form.connectionOptionLabels.${def.labelKey}` as Parameters<typeof i18n.t>[0])
      return (
        <Field key={fieldId}>
          <FieldLabel htmlFor={fieldId}>{fieldLabel}</FieldLabel>
          <Input
            id={fieldId}
            type={def.type}
            value={(localOptions[def.key]) ?? ""}
            placeholder={def.placeholder}
            onChange={e => setLocalOptions(prev => ({ ...prev, [def.key]: e.target.value }))}
          />
        </Field>
      )
    }

    return (
      <FieldGroup>
        {fieldDefs.map(renderField)}
      </FieldGroup>
    )
  },
})
