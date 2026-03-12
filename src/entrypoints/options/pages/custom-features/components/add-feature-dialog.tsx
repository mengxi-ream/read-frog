import type { CustomFeatureTemplate } from "@/utils/constants/custom-feature-templates"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/base-ui/dialog"
import { CUSTOM_FEATURE_TEMPLATES } from "@/utils/constants/custom-feature-templates"

export function AddFeatureDialog({ onSelect }: { onSelect: (template: CustomFeatureTemplate) => void }) {
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.templates.dialogTitle")}
        </DialogTitle>
        <DialogDescription>
          {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.templates.dialogDescription")}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        {CUSTOM_FEATURE_TEMPLATES.map(template => (
          <button
            key={template.id}
            type="button"
            className="flex items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/70"
            onClick={() => onSelect(template)}
          >
            <Icon icon={template.icon} className="size-5 shrink-0 text-zinc-600 dark:text-zinc-300" />
            <div className="min-w-0">
              <div className="text-sm font-medium">{i18n.t(template.nameKey)}</div>
              <div className="text-xs text-muted-foreground">{i18n.t(template.descriptionKey)}</div>
            </div>
          </button>
        ))}
      </div>
    </DialogContent>
  )
}
