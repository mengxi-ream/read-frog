import type { APIProviderConfig, ProviderSpecificSettingField } from "@/types/config/provider"
import { useSelector } from "@tanstack/react-store"
import { useMemo } from "react"
import { useAutosaveContext } from "@/components/form/use-autosave"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import { Input } from "@/components/ui/base-ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import {
  getProviderSpecificSettingFields,
  isLLMProvider,
  PROVIDER_SPECIFIC_SETTINGS_SCHEMAS,
} from "@/types/config/provider"
import { compactObject } from "@/types/utils"
import { i18n } from "@/utils/i18n"
import { withForm } from "./form"

function getProviderSpecificSettings(providerConfig: APIProviderConfig) {
  return "providerSpecificSettings" in providerConfig
    ? (providerConfig.providerSpecificSettings ?? {})
    : {}
}

export const ProviderSpecificSettingsField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useSelector(form.store, (state) => state.values)
    const providerType = providerConfig.provider
    const autosave = useAutosaveContext()
    const localSettings: Record<string, unknown> = getProviderSpecificSettings(providerConfig)
    const settingsSchema = useMemo(() => {
      if (!isLLMProvider(providerType)) return null
      return PROVIDER_SPECIFIC_SETTINGS_SCHEMAS[providerType] ?? null
    }, [providerType])
    const updateSetting = (key: string, value: unknown) => {
      const settings = compactObject({
        ...getProviderSpecificSettings(form.state.values),
        [key]: value,
      })
      form.setFieldValue(
        "providerSpecificSettings",
        (Object.keys(settings).length ? settings : undefined) as never,
      )
    }

    const fieldDefs = useMemo(() => {
      const defs = settingsSchema ? getProviderSpecificSettingFields(settingsSchema) : null
      return defs && defs.length > 0 ? defs : null
    }, [settingsSchema])

    if (!fieldDefs) return null

    const renderField = (def: ProviderSpecificSettingField) => {
      const fieldId = `${def.key}-${providerConfig.id}`
      const fieldLabel = i18n.t(
        `options.apiProviders.form.providerSettingLabels.${def.labelKey}` as never,
      )
      const fieldValue = localSettings[def.key]

      if (def.type === "select") {
        const selectedValue = typeof fieldValue === "string" ? fieldValue : def.defaultValue
        const selectedOption = def.options.find((option) => option.value === selectedValue)

        return (
          <Field key={fieldId}>
            <FieldLabel htmlFor={fieldId}>{fieldLabel}</FieldLabel>
            <Select
              value={selectedValue}
              onValueChange={(value) =>
                autosave.edit(() => updateSetting(def.key, value), { immediate: true })
              }
            >
              <SelectTrigger id={fieldId} className="w-full">
                <SelectValue placeholder={def.placeholder}>
                  {selectedOption
                    ? i18n.t(
                        `options.apiProviders.form.providerSettingOptionLabels.${selectedOption.labelKey}` as never,
                      )
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {def.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {i18n.t(
                        `options.apiProviders.form.providerSettingOptionLabels.${option.labelKey}` as never,
                      )}
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
            onChange={(e) => {
              const value = e.currentTarget.value
              autosave.edit(() => updateSetting(def.key, value))
            }}
            onCompositionStart={() => autosave.beginComposition(fieldId)}
            onCompositionEnd={(event) => {
              const value = event.currentTarget.value
              autosave.endComposition(fieldId, () => updateSetting(def.key, value))
            }}
            onBlur={() => void autosave.flush()}
          />
        </Field>
      )
    }

    return <FieldGroup>{fieldDefs.map(renderField)}</FieldGroup>
  },
})
