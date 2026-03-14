import type {
  SelectionToolbarCustomAction,
  SelectionToolbarCustomActionOutputField,
} from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useForm } from "@tanstack/react-form"
import { useEffect, useState } from "react"
import { fieldContext as FieldContext } from "@/components/form/form-context"
import { InputField } from "@/components/form/input-field"
import { QuickInsertableTextareaField } from "@/components/form/quick-insertable-textarea-field"
import { SelectField } from "@/components/form/select-field"
import { SortableList } from "@/components/sortable-list"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/base-ui/alert-dialog"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import { Checkbox } from "@/components/ui/base-ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/base-ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { selectionToolbarCustomActionOutputTypeSchema } from "@/types/config/selection-toolbar"
import {
  createOutputSchemaField,
  getNextOutputFieldName,
  getOutputSchemaFieldNameError,
  getSelectionToolbarCustomActionTokenCellText,
  normalizeOutputSchemaFieldName,
  SELECTION_TOOLBAR_CUSTOM_ACTION_TOKENS,
} from "@/utils/constants/custom-action"
import { withForm } from "./form"

const t = (key: string) => i18n.t(`options.floatingButtonAndToolbar.selectionToolbar.customActions.form.${key}`)

function FieldDialog({
  field: outputField,
  existingFields,
  title,
  open,
  onOpenChange,
  onSave,
}: {
  field: SelectionToolbarCustomActionOutputField
  existingFields: SelectionToolbarCustomActionOutputField[]
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (updated: SelectionToolbarCustomActionOutputField) => void
}) {
  const form = useForm({
    defaultValues: outputField,
    onSubmit: ({ value }) => {
      onSave({
        ...value,
        name: normalizeOutputSchemaFieldName(value.name),
      })
      onOpenChange(false)
    },
  })

  const validateNameField = (value: string) => {
    const errorType = getOutputSchemaFieldNameError(value, existingFields, outputField.id)
    if (errorType === "blank") {
      return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.errors.fieldKeyRequired")
    }
    if (errorType === "duplicate") {
      return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.errors.duplicateFieldKey")
    }
    return undefined
  }

  const customActionInsertCells = SELECTION_TOOLBAR_CUSTOM_ACTION_TOKENS.map(token => ({
    text: getSelectionToolbarCustomActionTokenCellText(token),
    description: i18n.t(`options.floatingButtonAndToolbar.selectionToolbar.customActions.form.tokens.${token}`),
  }))

  useEffect(() => {
    if (open) {
      form.reset(outputField)
    }
  }, [form, open, outputField])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid w-full gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            void form.handleSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <form.Field
              name="name"
              validators={{
                onChange: ({ value }) => validateNameField(value),
                onSubmit: ({ value }) => validateNameField(value),
              }}
            >
              {nameField => (
                <FieldContext value={nameField}>
                  <InputField
                    label={t("fieldName")}
                    placeholder={t("fieldNamePlaceholder")}
                  />
                </FieldContext>
              )}
            </form.Field>
            <form.Field name="type">
              {typeField => (
                <FieldContext value={typeField}>
                  <SelectField
                    label={t("fieldType")}
                    items={selectionToolbarCustomActionOutputTypeSchema.options.map(type => ({
                      value: type,
                      label: i18n.t(`dataTypes.${type}`),
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {selectionToolbarCustomActionOutputTypeSchema.options.map(type => (
                          <SelectItem key={type} value={type}>
                            {i18n.t(`dataTypes.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </SelectField>
                </FieldContext>
              )}
            </form.Field>
            <form.Field name="description">
              {descriptionField => (
                <FieldContext value={descriptionField}>
                  <QuickInsertableTextareaField
                    label={t("fieldDescription")}
                    placeholder={t("fieldDescriptionPlaceholder")}
                    className="min-h-20"
                    insertCells={customActionInsertCells}
                  />
                </FieldContext>
              )}
            </form.Field>
            <form.Field name="speaking">
              {(speakingField) => {
                const checkboxId = `custom-action-field-speaking-${outputField.id}`

                return (
                  <Field orientation="horizontal" className="items-center">
                    <Checkbox
                      id={checkboxId}
                      checked={speakingField.state.value}
                      onCheckedChange={checked => speakingField.handleChange(checked)}
                    />
                    <FieldLabel htmlFor={checkboxId}>{t("fieldSpeaking")}</FieldLabel>
                  </Field>
                )
              }}
            </form.Field>
          </FieldGroup>
          <DialogFooter>
            <form.Subscribe
              selector={state => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {t("editFieldDialog.save")}
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteFieldDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteFieldDialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteFieldDialog.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("deleteFieldDialog.cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>{t("deleteFieldDialog.confirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export const OutputSchemaField = withForm({
  ...{ defaultValues: {} as SelectionToolbarCustomAction },
  render: function Render({ form }) {
    const [editingField, setEditingField] = useState<SelectionToolbarCustomActionOutputField | null>(null)
    const [addingField, setAddingField] = useState<SelectionToolbarCustomActionOutputField | null>(null)
    const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null)

    return (
      <form.AppField
        name="outputSchema"
        validators={{
          onChange: ({ value }) => {
            const outputSchema = Array.isArray(value) ? value : []
            if (outputSchema.length === 0) {
              return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.errors.outputSchemaRequired")
            }

            for (const outputField of outputSchema) {
              const errorType = getOutputSchemaFieldNameError(outputField.name, outputSchema, outputField.id)
              if (errorType === "blank") {
                return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.errors.fieldKeyRequired")
              }
              if (errorType === "duplicate") {
                return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.errors.duplicateFieldKey")
              }
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
                <FieldLabel>{t("outputSchema")}</FieldLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextName = getNextOutputFieldName(outputSchema, t("autoFieldPrefix"))
                    setAddingField(createOutputSchemaField(nextName))
                  }}
                >
                  <Icon icon="tabler:plus" className="size-4" />
                  {t("addField")}
                </Button>
              </div>

              <SortableList
                list={outputSchema}
                setList={(newList) => {
                  field.handleChange(newList)
                  void form.handleSubmit()
                }}
                className="flex flex-col gap-2"
                renderItem={outputField => (
                  <div className="flex items-center gap-2 rounded-lg border bg-card p-2">
                    <Icon icon="tabler:grip-vertical" className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium shrink-0">{outputField.name}</span>
                    <Badge variant="secondary" className="shrink-0">{i18n.t(`dataTypes.${outputField.type}`)}</Badge>
                    <span className="text-sm text-muted-foreground truncate min-w-0 flex-1">
                      {outputField.description || "—"}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-7"
                        onClick={() => setEditingField(outputField)}
                        onPointerDown={e => e.stopPropagation()}
                      >
                        <Icon icon="tabler:pencil" className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-7"
                        onClick={() => setDeletingFieldId(outputField.id)}
                        onPointerDown={e => e.stopPropagation()}
                        disabled={outputSchema.length === 1}
                      >
                        <Icon icon="tabler:trash" className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              />

              {addingField && (
                <FieldDialog
                  field={addingField}
                  existingFields={outputSchema}
                  title={t("addFieldDialog.title")}
                  open={!!addingField}
                  onOpenChange={(open) => {
                    if (!open)
                      setAddingField(null)
                  }}
                  onSave={(created) => {
                    field.handleChange([...outputSchema, created])
                    void form.handleSubmit()
                    setAddingField(null)
                  }}
                />
              )}

              {editingField && (
                <FieldDialog
                  field={editingField}
                  existingFields={outputSchema}
                  title={t("editFieldDialog.title")}
                  open={!!editingField}
                  onOpenChange={(open) => {
                    if (!open)
                      setEditingField(null)
                  }}
                  onSave={(updated) => {
                    const nextOutputSchema = outputSchema.map(item =>
                      item.id === updated.id ? updated : item,
                    )
                    field.handleChange(nextOutputSchema)
                    void form.handleSubmit()
                    setEditingField(null)
                  }}
                />
              )}

              <DeleteFieldDialog
                open={!!deletingFieldId}
                onOpenChange={(open) => {
                  if (!open)
                    setDeletingFieldId(null)
                }}
                onConfirm={() => {
                  if (deletingFieldId) {
                    field.handleChange(outputSchema.filter(item => item.id !== deletingFieldId))
                    void form.handleSubmit()
                    setDeletingFieldId(null)
                  }
                }}
              />

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
