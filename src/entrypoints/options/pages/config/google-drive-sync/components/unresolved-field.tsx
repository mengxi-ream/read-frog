import type { CSSProperties } from "react"
import { Icon } from "@iconify/react"
import { dequal } from "dequal"
import { Button } from "@/components/ui/base-ui/button"
import { useConflictField } from "@/hooks/use-unresolved-field"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { FieldOptionRow, STYLE_MAP } from "./field-option-row"
import { isMeaningfulFieldKey } from "./utils"

interface ConflictFieldProps {
  pathKey: string
  indent: number
}

export function ConflictField({ pathKey, indent }: ConflictFieldProps) {
  const { conflict, resolution, selectLocal, selectRemote, reset } = useConflictField(pathKey)

  if (!conflict) return null

  const fieldKey = conflict.path.at(-1) ?? ""
  const showFieldKey = isMeaningfulFieldKey(fieldKey)

  // Determine the type of change
  const localChanged = !dequal(conflict.localValue, conflict.baseValue)
  const remoteChanged = !dequal(conflict.remoteValue, conflict.baseValue)
  const bothChanged = localChanged && remoteChanged

  // Select appropriate container style
  const getContainerStyle = () => {
    if (resolution) return STYLE_MAP[resolution]
    return STYLE_MAP.unresolved
  }
  const containerStyle = getContainerStyle()

  // Get the appropriate icon and label
  const getIconAndLabel = () => {
    const label = bothChanged
      ? i18n.t("options.config.sync.googleDrive.unresolved.bothChanged")
      : localChanged
        ? i18n.t("options.config.sync.googleDrive.unresolved.localChanged")
        : i18n.t("options.config.sync.googleDrive.unresolved.remoteChanged")

    return {
      icon: "tabler:git-merge",
      iconClass: "text-orange-500 dark:text-orange-400",
      label,
      labelClass: "text-orange-600 dark:text-orange-300 font-semibold",
    }
  }
  const { icon, iconClass, label, labelClass } = getIconAndLabel()

  const options = [
    { type: "local" as const, value: conflict.localValue, onClick: selectLocal },
    { type: "remote" as const, value: conflict.remoteValue, onClick: selectRemote },
  ]

  return (
    <div
      className={cn("my-1 border-l-4", containerStyle.bg, containerStyle.border)}
      style={{ "--indent": `${indent}px` } as CSSProperties}
    >
      <div className="flex h-8 items-center py-1 ps-(--indent)">
        <Icon icon={icon} className={cn("mr-2 size-4 shrink-0", iconClass)} />
        <span className={cn("text-xs", labelClass)}>{label}</span>
        {resolution && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-2 h-6 text-xs text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            onClick={reset}
          >
            <Icon icon="mdi:undo" className="mr-1 size-3" />
            {i18n.t("options.config.sync.googleDrive.unresolved.reset")}
          </Button>
        )}
      </div>

      {options.map(({ type, value, onClick }) => (
        <FieldOptionRow
          key={type}
          type={type}
          value={value}
          isSelected={resolution === type}
          fieldKey={fieldKey}
          showFieldKey={showFieldKey}
          onClick={onClick}
        />
      ))}
    </div>
  )
}
