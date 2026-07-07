import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { Icon } from "@iconify/react"
import { useSelector } from "@tanstack/react-store"
import { useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Field, FieldLabel } from "@/components/ui/base-ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/base-ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/base-ui/popover"
import { ICON_PATTERN } from "@/utils/constants/custom-action"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { withForm } from "./form"
import { CURATED_ICON_OPTIONS } from "./icon-field-options"

interface IconPickerPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  previewIcon: string
  selectedIcon: string | undefined
  onSelect: (icon: string) => void
}

function IconPickerPopover({
  open,
  onOpenChange,
  previewIcon,
  selectedIcon,
  onSelect,
}: IconPickerPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={(
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.iconField.chooseAriaLabel")}
          />
        )}
      >
        {previewIcon && <Icon icon={previewIcon} />}
      </PopoverTrigger>

      <PopoverContent align="start">
        <PopoverHeader>
          <PopoverTitle>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.iconField.chooseTitle")}</PopoverTitle>
        </PopoverHeader>
        <div className="grid grid-cols-6 gap-1">
          {CURATED_ICON_OPTIONS.map(icon => (
            <Button
              key={icon}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={icon}
              className={cn(selectedIcon === icon && "bg-muted text-foreground")}
              onClick={() => onSelect(icon)}
            >
              <Icon icon={icon} />
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function IconHelpPopover() {
  return (
    <Popover>
      <PopoverTrigger
        render={(
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.iconField.helpAriaLabel")}
          />
        )}
      >
        <Icon icon="tabler:dots" />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10}>
        <PopoverHeader>
          <PopoverTitle>{i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.iconField.helpTitle")}</PopoverTitle>
        </PopoverHeader>
        <ol className="flex flex-col gap-1">
          <li>
            <span className="font-medium">1.</span>
            {" "}
            {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.iconField.helpStepBrowsePrefix")}
            <a
              href="https://icon-sets.iconify.design/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-link hover:underline"
            >
              Iconify
              <Icon icon="tabler:external-link" className="size-3.5" />
            </a>
            {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.iconField.helpStepBrowseSuffix")}
          </li>
          <li>
            <span className="font-medium">2.</span>
            {" "}
            {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.iconField.helpStepCopyPrefix")}
            <code className="rounded-sm bg-muted px-1 py-0.5 text-[13px]">
              tabler:book-2
            </code>
            {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.iconField.helpStepCopySuffix")}
          </li>
        </ol>
      </PopoverContent>
    </Popover>
  )
}

export const IconField = withForm({
  ...{ defaultValues: {} as SelectionToolbarCustomAction },
  render: function Render({ form }) {
    const iconValue = useSelector(form.store, state => state.values.icon)
    const [iconPickerOpen, setIconPickerOpen] = useState(false)
    const hasError = !ICON_PATTERN.test(iconValue?.trim() ?? "")
    const previewIcon = iconValue?.trim() ?? ""

    return (
      <form.AppField
        name="icon"
        validators={{
          onChange: ({ value }) => {
            if (!ICON_PATTERN.test(value.trim())) {
              return i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.errors.invalidIcon")
            }
            return undefined
          },
        }}
      >
        {field => (
          <Field>
            <FieldLabel nativeLabel={false} render={<div />}>
              {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.icon")}
            </FieldLabel>
            <div className="flex items-center gap-2">
              <IconPickerPopover
                open={iconPickerOpen}
                onOpenChange={setIconPickerOpen}
                previewIcon={previewIcon}
                selectedIcon={field.state.value}
                onSelect={(icon) => {
                  field.handleChange(icon)
                  void form.handleSubmit()
                  setIconPickerOpen(false)
                }}
              />

              <InputGroup className="flex-1">
                <InputGroupInput
                  value={field.state.value ?? ""}
                  placeholder={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.iconField.inputPlaceholder")}
                  aria-invalid={hasError}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    field.handleChange(e.target.value)
                    void form.handleSubmit()
                  }}
                />
                <InputGroupAddon align="inline-end">
                  <IconHelpPopover />
                </InputGroupAddon>
              </InputGroup>
            </div>
            {field.state.meta.errors.length > 0 && (
              <span className="text-sm font-normal text-destructive">
                {field.state.meta.errors.join(", ")}
              </span>
            )}
          </Field>
        )}
      </form.AppField>
    )
  },
})
