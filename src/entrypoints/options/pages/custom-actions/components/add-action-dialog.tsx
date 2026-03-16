import type { CustomActionTemplate } from "@/utils/constants/custom-action-templates"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/base-ui/dialog"
import { CUSTOM_ACTION_TEMPLATES } from "@/utils/constants/custom-action-templates"

type TemplateI18nKey = Parameters<typeof i18n.t>[0]

function tTemplateKey(key: string) {
  return i18n.t(key as TemplateI18nKey)
}

export function AddActionDialog({ onSelect }: { onSelect: (template: CustomActionTemplate) => void }) {
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.templates.dialogTitle")}
        </DialogTitle>
        <DialogDescription>
          {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.templates.dialogDescription")}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        {CUSTOM_ACTION_TEMPLATES.map(template => (
          <button
            key={template.id}
            type="button"
            className="flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/70"
            onClick={() => onSelect(template)}
          >
            <Icon icon={template.icon} className="size-5 shrink-0 text-zinc-600 dark:text-zinc-300" />
            <div className="min-w-0">
              <div className="text-sm font-medium">{tTemplateKey(template.nameKey)}</div>
              <div className="text-xs text-muted-foreground">{tTemplateKey(template.descriptionKey)}</div>
            </div>
          </button>
        ))}
      </div>
    </DialogContent>
  )
}
