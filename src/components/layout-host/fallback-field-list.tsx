import type { LayoutStatus } from "@read-frog/layout-engine/contract"
import type { SelectionToolbarCustomActionOutputField } from "@/types/config/selection-toolbar"
import { formatLayoutFieldValue } from "@read-frog/layout-engine/core"
import { IconHash, IconTypography } from "@tabler/icons-react"

// Last resort of the layout fallback chain (custom layout → default layout →
// this): a plain React field list that never touches Liquid, the sanitizer or
// innerHTML, so it renders whatever the layout pipeline could not. Same look as
// the default layout, which recreates the list custom actions showed before
// layouts existed. No speak buttons: those need the layout host's shadow root.

interface FallbackFieldListProps {
  outputSchema: SelectionToolbarCustomActionOutputField[]
  value: Record<string, unknown> | null
  status: LayoutStatus
}

export function FallbackFieldList({ outputSchema, value, status }: FallbackFieldListProps) {
  return (
    <div className="space-y-3" data-slot="custom-action-fallback-field-list">
      {outputSchema.map((field) => {
        const present = value !== null && Object.hasOwn(value, field.name)
        const pending = status === "streaming" && !present
        const display = present ? formatLayoutFieldValue(value[field.name], field.type) : undefined
        const TypeIcon = field.type === "number" ? IconHash : IconTypography

        return (
          <div key={field.id} data-slot="custom-action-field-row">
            <div className="flex h-6 items-center gap-0.5">
              <div className="inline-flex min-w-0 items-center gap-0.5 text-xs font-medium text-muted-foreground">
                <TypeIcon className="size-3 shrink-0" strokeWidth={1.8} />
                <span className="truncate">{field.name}</span>
              </div>
            </div>
            <div className="text-sm [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
              {pending ? "…" : display === undefined ? "—" : String(display)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
