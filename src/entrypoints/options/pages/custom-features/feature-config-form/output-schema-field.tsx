import type {
  SelectionToolbarCustomFeature,
  SelectionToolbarCustomFeatureOutputField,
} from "@/types/config/selection-toolbar"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { useState } from "react"
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
import { Button } from "@/components/ui/base-ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/base-ui/dialog"
import { Field, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/base-ui/field"
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
import { Textarea } from "@/components/ui/base-ui/textarea"
import { selectionToolbarCustomFeatureOutputTypeSchema } from "@/types/config/selection-toolbar"
import {
  createOutputSchemaField,
  getNextOutputFieldName,
} from "@/utils/constants/custom-feature"
import { withForm } from "./form"

const t = (key: string) => i18n.t(`options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.${key}`)

function FieldDialog({
  field: outputField,
  title,
  open,
  onOpenChange,
  onSave,
}: {
  field: SelectionToolbarCustomFeatureOutputField
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (updated: SelectionToolbarCustomFeatureOutputField) => void
}) {
  const [draft, setDraft] = useState(outputField)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldTitle>{t("fieldName")}</FieldTitle>
            <Input
              value={draft.name}
              onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t("fieldNamePlaceholder")}
            />
          </Field>
          <Field>
            <FieldTitle>{t("fieldType")}</FieldTitle>
            <Select
              items={selectionToolbarCustomFeatureOutputTypeSchema.options.map(type => ({
                value: type,
                label: i18n.t(`dataTypes.${type}`),
              }))}
              value={draft.type}
              onValueChange={(value) => {
                if (value) {
                  setDraft(prev => ({ ...prev, type: value }))
                }
              }}
            >
              <SelectTrigger>
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
          </Field>
          <Field>
            <FieldTitle>{t("fieldDescription")}</FieldTitle>
            <Textarea
              value={draft.description}
              onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t("fieldDescriptionPlaceholder")}
              className="min-h-20"
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              onSave(draft)
              onOpenChange(false)
            }}
          >
            {t("editFieldDialog.save")}
          </Button>
        </DialogFooter>
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
  ...{ defaultValues: {} as SelectionToolbarCustomFeature },
  render: function Render({ form }) {
    const [editingField, setEditingField] = useState<SelectionToolbarCustomFeatureOutputField | null>(null)
    const [addingField, setAddingField] = useState<SelectionToolbarCustomFeatureOutputField | null>(null)
    const [deletingFieldId, setDeletingFieldId] = useState<string | null>(null)

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

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("fieldName")}</TableHead>
                    <TableHead>{t("fieldType")}</TableHead>
                    <TableHead>{t("fieldDescription")}</TableHead>
                    <TableHead className="text-right">{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outputSchema.map(outputField => (
                    <TableRow key={outputField.id}>
                      <TableCell className="font-medium">{outputField.name}</TableCell>
                      <TableCell>{i18n.t(`dataTypes.${outputField.type}`)}</TableCell>
                      <TableCell>
                        <span className="block max-w-[200px] truncate">
                          {outputField.description || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setEditingField(outputField)}
                          >
                            <Icon icon="tabler:pencil" className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setDeletingFieldId(outputField.id)}
                            disabled={outputSchema.length === 1}
                          >
                            <Icon icon="tabler:trash" className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {addingField && (
                <FieldDialog
                  field={addingField}
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
