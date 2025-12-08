import type { CSSProperties } from 'react'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { Button } from '@/components/shadcn/button'
import { useUnresolvedField } from '@/hooks/use-unresolved-field'
import { cn } from '@/lib/utils'
import { FieldOptionRow, STYLE_MAP } from './field-option-row'

interface UnresolvedFieldProps {
  pathKey: string
  indent: number
}

export function UnresolvedField({ pathKey, indent }: UnresolvedFieldProps) {
  const { unresolved, resolution, selectLocal, selectRemote, reset } = useUnresolvedField(pathKey)

  if (!unresolved)
    return null

  const fieldKey = unresolved.path.at(-1) ?? ''
  const showFieldKey = Number.isNaN(Number(fieldKey))
  const containerStyle = resolution ? STYLE_MAP[resolution] : STYLE_MAP.unresolved

  const options = [
    { type: 'local' as const, value: unresolved.localValue, onClick: selectLocal },
    { type: 'remote' as const, value: unresolved.remoteValue, onClick: selectRemote },
  ]

  return (
    <div
      className={cn('border-l-4 my-1', containerStyle.bg, containerStyle.border)}
      style={{ '--indent': `${indent}px` } as CSSProperties}
    >
      <div className="flex items-center py-1 ps-(--indent)">
        <Icon icon="mdi:alert" className="size-4 text-orange-500 dark:text-orange-400 shrink-0 mr-2" />
        <span className="text-orange-600 dark:text-orange-300 text-xs font-semibold">
          {i18n.t('options.config.sync.googleDrive.unresolved.unresolvedPrompt')}
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
