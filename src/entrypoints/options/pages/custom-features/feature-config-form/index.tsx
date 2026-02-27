import type {
  SelectionToolbarCustomFeature,
  SelectionToolbarCustomFeatureOutputType,
} from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useAtom, useAtomValue } from "jotai"
import { useEffect } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Field, FieldLabel } from "@/components/ui/base-ui/field"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/base-ui/table"
import { QuickInsertableTextarea } from "@/components/ui/insertable-textarea"
import { selectionToolbarCustomFeatureOutputTypeSchema } from "@/types/config/selection-toolbar"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  createOutputSchemaField,
  getNextOutputFieldKey,
  getSelectionToolbarCustomFeatureTokenCellText,
  SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS,
} from "@/utils/constants/selection-toolbar-custom-feature"
import { cn } from "@/utils/styles/utils"
import { selectedCustomFeatureIdAtom } from "../atoms"
import { formOpts, useAppForm } from "./form"
import { IconField } from "./icon-field"
import { NameField } from "./name-field"
import { ProviderField } from "./provider-field"

export function CustomFeatureConfigForm() {
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const [selectedCustomFeatureId] = useAtom(selectedCustomFeatureIdAtom)

  const customFeatures = selectionToolbarConfig.customFeatures ?? []
  const selectedFeature = customFeatures.find(feature => feature.id === selectedCustomFeatureId)

  if (!selectedFeature) {
    return (
      <div className="flex-1 bg-card rounded-xl p-4 border min-h-[420px] flex items-center justify-center text-sm text-muted-foreground">
        {customFeatures.length === 0
          ? i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.empty")
          : i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.edit")}
      </div>
    )
  }

  // Force remount per feature to avoid transient undefined field states during selection switches.
  return <CustomFeatureConfigEditor key={selectedFeature.id} selectedFeature={selectedFeature} />
}

function CustomFeatureConfigEditor({ selectedFeature }: { selectedFeature: SelectionToolbarCustomFeature }) {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(configFieldsAtomMap.selectionToolbar)
  const [, setSelectedCustomFeatureId] = useAtom(selectedCustomFeatureIdAtom)

  const customFeatures = selectionToolbarConfig.customFeatures ?? []

  const form = useAppForm({
    ...formOpts,
    defaultValues: selectedFeature,
    onSubmit: async ({ value }) => {
      const updatedCustomFeatures = customFeatures.map(feature =>
        feature.id === selectedFeature.id ? value : feature,
      )

      await setSelectionToolbarConfig({
        ...selectionToolbarConfig,
        customFeatures: updatedCustomFeatures,
      })
    },
  })

  useEffect(() => {
    form.reset(selectedFeature)
  }, [selectedFeature, form])

  const handleDeleteFeature = () => {
    const currentIndex = customFeatures.findIndex(feature => feature.id === selectedFeature.id)
    if (currentIndex < 0) {
      return
    }

    const updatedCustomFeatures = customFeatures.filter(feature => feature.id !== selectedFeature.id)
    const nextSelectedFeature = updatedCustomFeatures[currentIndex] ?? updatedCustomFeatures[currentIndex - 1]

    void setSelectionToolbarConfig({
      ...selectionToolbarConfig,
      customFeatures: updatedCustomFeatures,
    })
    setSelectedCustomFeatureId(nextSelectedFeature?.id)
  }

  return (
    <form.AppForm>
      <div className={cn("flex-1 bg-card rounded-xl p-4 border flex flex-col justify-between")}>
        <div className="flex flex-col gap-4">
          <NameField form={form} />

          <IconField form={form} />

          <ProviderField form={form} />

          <form.AppField name="systemPrompt">
            {field => (
              <Field>
                <FieldLabel>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.systemPrompt")}</FieldLabel>
                <QuickInsertableTextarea
                  value={field.state.value}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                    field.handleChange(event.target.value)
                    void form.handleSubmit()
                  }}
                  className="min-h-36 max-h-80"
                  insertCells={SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS.map(token => ({
                    text: getSelectionToolbarCustomFeatureTokenCellText(token),
                    description: i18n.t(`options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.tokens.${token}`),
                  }))}
                />
              </Field>
            )}
          </form.AppField>

          <form.AppField name="prompt">
            {field => (
              <Field>
                <FieldLabel>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.prompt")}</FieldLabel>
                <QuickInsertableTextarea
                  value={field.state.value}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                    field.handleChange(event.target.value)
                    void form.handleSubmit()
                  }}
                  className="min-h-28 max-h-80"
                  insertCells={SELECTION_TOOLBAR_CUSTOM_FEATURE_TOKENS.map(token => ({
                    text: getSelectionToolbarCustomFeatureTokenCellText(token),
                    description: i18n.t(`options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.tokens.${token}`),
                  }))}
                />
              </Field>
            )}
          </form.AppField>

          <form.AppField
            name="outputSchema"
            validators={{
              onChange: ({ value }) => {
                const outputSchema = Array.isArray(value) ? value : []
                if (outputSchema.length === 0) {
                  return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.errors.outputSchemaRequired")
                }

                const keySet = new Set<string>()
                for (const outputField of outputSchema) {
                  const key = outputField.key.trim()
                  if (!key) {
                    return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.errors.fieldKeyRequired")
                  }
                  if (keySet.has(key)) {
                    return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.errors.duplicateFieldKey")
                  }
                  keySet.add(key)
                }

                return undefined
              },
            }}
          >
            {(field) => {
              const outputSchema = Array.isArray(field.state.value) ? field.state.value : []

              return (
                <Field>
                  <div className="flex items-center justify-between">
                    <FieldLabel>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.outputSchema")}</FieldLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nextKey = getNextOutputFieldKey(outputSchema)
                        field.handleChange([...outputSchema, createOutputSchemaField(nextKey)])
                        void form.handleSubmit()
                      }}
                    >
                      <Icon icon="tabler:plus" className="size-4" />
                      {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.addField")}
                    </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.fieldName")}</TableHead>
                        <TableHead>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.fieldType")}</TableHead>
                        <TableHead className="text-right">{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outputSchema.map(outputField => (
                        <TableRow key={outputField.id}>
                          <TableCell>
                            <Input
                              value={outputField.key}
                              onChange={(event) => {
                                const nextOutputSchema = outputSchema.map(item =>
                                  item.id === outputField.id ? { ...item, key: event.target.value } : item,
                                )
                                field.handleChange(nextOutputSchema)
                                void form.handleSubmit()
                              }}
                              placeholder="field_name"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              items={selectionToolbarCustomFeatureOutputTypeSchema.options.map(type => ({
                                value: type,
                                label: type,
                              }))}
                              value={outputField.type}
                              onValueChange={(value) => {
                                if (!value) {
                                  return
                                }
                                const nextOutputSchema = outputSchema.map(item =>
                                  item.id === outputField.id
                                    ? { ...item, type: value as SelectionToolbarCustomFeatureOutputType }
                                    : item,
                                )
                                field.handleChange(nextOutputSchema)
                                void form.handleSubmit()
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  {selectionToolbarCustomFeatureOutputTypeSchema.options.map(type => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                if (outputSchema.length === 1) {
                                  return
                                }
                                field.handleChange(outputSchema.filter(item => item.id !== outputField.id))
                                void form.handleSubmit()
                              }}
                              disabled={outputSchema.length === 1}
                            >
                              <Icon icon="tabler:trash" className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {field.state.meta.errors.length > 0 && (
                    <span className="text-sm font-normal text-destructive">
                      {field.state.meta.errors.map(error => typeof error === "string" ? error : error?.message).join(", ")}
                    </span>
                  )}
                </Field>
              )
            }}
          </form.AppField>
        </div>
        <div className="flex justify-end mt-8">
          <Button type="button" variant="destructive" onClick={handleDeleteFeature}>
            {i18n.t("options.apiProviders.form.delete")}
          </Button>
        </div>
      </div>
    </form.AppForm>
  )
}
