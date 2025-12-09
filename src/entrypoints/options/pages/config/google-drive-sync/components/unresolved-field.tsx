import type { CSSProperties } from 'react'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { dequal } from 'dequal'
import { Button } from '@/components/shadcn/button'
import { useConflictField } from '@/hooks/use-unresolved-field'
import { cn } from '@/lib/utils'
import { FieldOptionRow, STYLE_MAP } from './field-option-row'

interface ConflictFieldProps {
  pathKey: string
  indent: number
}

export function ConflictField({ pathKey, indent }: ConflictFieldProps) {
  const { conflict, resolution, selectLocal, selectRemote, reset } = useConflictField(pathKey)

  if (!conflict)
    return null

  const fieldKey = conflict.path.at(-1) ?? ''
  const showFieldKey = !Number.isNaN(Number(fieldKey)) === false

  // Determine the type of change
  const localChanged = !dequal(conflict.localValue, conflict.baseValue)
  const remoteChanged = !dequal(conflict.remoteValue, conflict.baseValue)
  const isTrueConflict = localChanged && remoteChanged

  // Select appropriate container style
  const getContainerStyle = () => {
    if (resolution)
      return STYLE_MAP[resolution]
    return isTrueConflict ? STYLE_MAP.unresolved : STYLE_MAP.difference
  }
  const containerStyle = getContainerStyle()

  // Get the appropriate icon and label
  const getIconAndLabel = () => {
    if (isTrueConflict) {
      return {
        icon: 'mdi:alert',
        iconClass: 'text-orange-500 dark:text-orange-400',
        label: i18n.t('options.config.sync.googleDrive.unresolved.unresolvedPrompt'),
        labelClass: 'text-orange-600 dark:text-orange-300 font-semibold',
      }
    }
    return {
      icon: 'mdi:swap-horizontal',
      iconClass: 'text-slate-500 dark:text-slate-400',
      label: localChanged
        ? i18n.t('options.config.sync.googleDrive.unresolved.localChanged')
        : i18n.t('options.config.sync.googleDrive.unresolved.remoteChanged'),
      labelClass: 'text-slate-600 dark:text-slate-300',
    }
  }
  const { icon, iconClass, label, labelClass } = getIconAndLabel()

  const options = [
    { type: 'local' as const, value: conflict.localValue, onClick: selectLocal },
    { type: 'remote' as const, value: conflict.remoteValue, onClick: selectRemote },
  ]

  return (
    <div
      className={cn('border-l-4 my-1', containerStyle.bg, containerStyle.border)}
      style={{ '--indent': `${indent}px` } as CSSProperties}
    >
      <div className="flex items-center py-1 ps-(--indent)">
        <Icon icon={icon} className={cn('size-4 shrink-0 mr-2', iconClass)} />
        <span className={cn('text-xs', labelClass)}>
          {label}
        </span>
        {resolution && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 ml-2"
            onClick={reset}
          >
            <Icon icon="mdi:undo" className="size-3 mr-1" />
            {i18n.t('options.config.sync.googleDrive.unresolved.reset')}
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
