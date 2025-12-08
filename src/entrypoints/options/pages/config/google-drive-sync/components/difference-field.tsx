import type { CSSProperties } from 'react'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { dequal } from 'dequal'
import { Button } from '@/components/shadcn/button'
import { useDifferenceField } from '@/hooks/use-unresolved-field'
import { cn } from '@/lib/utils'
import { FieldOptionRow, STYLE_MAP } from './field-option-row'

interface DifferenceFieldProps {
  pathKey: string
  indent: number
}

export function DifferenceField({ pathKey, indent }: DifferenceFieldProps) {
  const { difference, resolution, selectLocal, selectRemote, reset } = useDifferenceField(pathKey)

  if (!difference)
    return null

  const fieldKey = difference.path.at(-1) ?? ''
  const showFieldKey = !Number.isNaN(Number(fieldKey)) === false
  const containerStyle = resolution ? STYLE_MAP[resolution] : STYLE_MAP.difference

  // Determine which side changed (for display purposes)
  const localChanged = !dequal(difference.localValue, difference.baseValue)

  const options = [
    { type: 'local' as const, value: difference.localValue, onClick: selectLocal },
    { type: 'remote' as const, value: difference.remoteValue, onClick: selectRemote },
  ]

  return (
    <div
      className={cn('border-l-4 my-1', containerStyle.bg, containerStyle.border)}
      style={{ '--indent': `${indent}px` } as CSSProperties}
    >
      <div className="flex items-center py-1 ps-(--indent)">
        <Icon icon="mdi:swap-horizontal" className="size-4 text-slate-500 dark:text-slate-400 shrink-0 mr-2" />
        <span className="text-slate-600 dark:text-slate-300 text-xs">
          {localChanged
            ? i18n.t('options.config.sync.googleDrive.unresolved.localChanged')
            : i18n.t('options.config.sync.googleDrive.unresolved.remoteChanged')}
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
