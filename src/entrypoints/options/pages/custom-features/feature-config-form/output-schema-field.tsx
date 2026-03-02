import type {
  SelectionToolbarCustomFeature,
} from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
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
import { selectionToolbarCustomFeatureOutputTypeSchema } from "@/types/config/selection-toolbar"
import {
  createOutputSchemaField,
  getNextOutputFieldName,
} from "@/utils/constants/selection-toolbar-custom-feature"
import { withForm } from "./form"

export const OutputSchemaField = withForm({
  ...{ defaultValues: {} as SelectionToolbarCustomFeature },
  render: function Render({ form }) {
    return (
      <form.AppField
        name="outputSchema"
        validators={{
          onChange: ({ value }) => {
            const outputSchema = Array.isArray(value) ? value : []
            if (outputSchema.length === 0) {
              return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.errors.outputSchemaRequired")
            }

            const nameSet = new Set<string>()
            for (const outputField of outputSchema) {
              const name = outputField.name.trim()
              if (!name) {
                return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.errors.fieldKeyRequired")
              }
              if (nameSet.has(name)) {
                return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.errors.duplicateFieldKey")
              }
              nameSet.add(name)
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
                    const nextName = getNextOutputFieldName(outputSchema, i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.autoFieldPrefix"))
                    field.handleChange([...outputSchema, createOutputSchemaField(nextName)])
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
                          value={outputField.name}
                          onChange={(event) => {
                            const nextOutputSchema = outputSchema.map(item =>
                              item.id === outputField.id ? { ...item, name: event.target.value } : item,
                            )
                            field.handleChange(nextOutputSchema)
                            void form.handleSubmit()
                          }}
                          placeholder={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.fieldNamePlaceholder")}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          items={selectionToolbarCustomFeatureOutputTypeSchema.options.map(type => ({
                            value: type,
                            label: i18n.t(`dataTypes.${type}`),
                          }))}
                          value={outputField.type}
                          onValueChange={(value) => {
                            if (!value) {
                              return
                            }
                            const nextOutputSchema = outputSchema.map(item =>
                              item.id === outputField.id
                                ? { ...item, type: value }
                                : item,
                            )
                            field.handleChange(nextOutputSchema)
                            void form.handleSubmit()
                          }}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {selectionToolbarCustomFeatureOutputTypeSchema.options.map(type => (
                                <SelectItem key={type} value={type}>
                                  {i18n.t(`dataTypes.${type}`)}
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
    )
  },
})
