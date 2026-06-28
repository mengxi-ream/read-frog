import type { APIProviderConfig, LLMProviderTypes, ProviderSpecificSettingField } from "@/types/config/provider"
import { useSelector } from "@tanstack/react-store"
import { useEffect, useEffectEvent, useMemo, useState } from "react"
import { i18n } from "#imports"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/base-ui/select"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getProviderSpecificSettingFields, isLLMProvider, PROVIDER_SPECIFIC_SETTINGS_SCHEMAS } from "@/types/config/provider"
import { compactObject } from "@/types/utils"
import { withForm } from "./form"

function getProviderSpecificSettings(providerConfig: APIProviderConfig) {
  return "providerSpecificSettings" in providerConfig
    ? (providerConfig.providerSpecificSettings as Record<string, unknown> | undefined) ?? {}
    : {}
}

export const ProviderSpecificSettingsField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useSelector(form.store, state => state.values)
    const providerType = providerConfig.provider
    const [localSettings, setLocalSettings] = useState<Record<string, unknown>>(
      () => getProviderSpecificSettings(providerConfig),
    )

    // Sync local state when switching provider
    const syncLocalSettings = useEffectEvent(() => {
      // eslint-disable-next-line react/set-state-in-effect
      setLocalSettings(getProviderSpecificSettings(providerConfig))
    })

    useEffect(() => {
      syncLocalSettings()
    }, [providerConfig.id])

    const debouncedSettings = useDebouncedValue(localSettings, 500)

    const settingsSchema = useMemo(() => {
      if (!isLLMProvider(providerType))
        return null
      return PROVIDER_SPECIFIC_SETTINGS_SCHEMAS[providerType as LLMProviderTypes] ?? null
    }, [providerType])

    // Submit when debounced value changes
    useEffect(() => {
      if (!settingsSchema)
        return

      const compacted = compactObject(debouncedSettings)
      const setProviderSpecificSettings = form.setFieldValue as unknown as (
        field: "providerSpecificSettings",
        value: Record<string, unknown> | undefined,
      ) => void
      setProviderSpecificSettings("providerSpecificSettings", Object.keys(compacted).length > 0 ? compacted : undefined)
      void form.handleSubmit()
    }, [debouncedSettings, form, settingsSchema])

    const fieldDefs = useMemo(() => {
      const defs = settingsSchema ? getProviderSpecificSettingFields(settingsSchema) : null
      return defs && defs.length > 0 ? defs : null
    }, [settingsSchema])

    if (!fieldDefs)
      return null

    const renderField = (def: ProviderSpecificSettingField) => {
      const fieldId = `${def.key}-${providerConfig.id}`
      const fieldLabel = i18n.t(`options.apiProviders.form.providerSettingLabels.${def.labelKey}` as Parameters<typeof i18n.t>[0])
      const fieldValue = localSettings[def.key]

      if (def.type === "select") {
        const selectedValue = typeof fieldValue === "string" ? fieldValue : def.defaultValue
        const selectedOption = def.options.find(option => option.value === selectedValue)

        return (
          <Field key={fieldId}>
            <FieldLabel htmlFor={fieldId}>{fieldLabel}</FieldLabel>
            <Select
              value={selectedValue}
              onValueChange={value => setLocalSettings(prev => ({ ...prev, [def.key]: value }))}
            >
              <SelectTrigger id={fieldId} className="w-full">
                <SelectValue placeholder={def.placeholder}>
                  {selectedOption
                    ? i18n.t(`options.apiProviders.form.providerSettingOptionLabels.${selectedOption.labelKey}` as Parameters<typeof i18n.t>[0])
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {def.options.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {i18n.t(`options.apiProviders.form.providerSettingOptionLabels.${option.labelKey}` as Parameters<typeof i18n.t>[0])}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        )
      }

      return (
        <Field key={fieldId}>
          <FieldLabel htmlFor={fieldId}>{fieldLabel}</FieldLabel>
          <Input
            id={fieldId}
            type={def.type}
            value={typeof fieldValue === "string" ? fieldValue : ""}
            placeholder={def.placeholder}
            onChange={e => setLocalSettings(prev => ({ ...prev, [def.key]: e.target.value }))}
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
