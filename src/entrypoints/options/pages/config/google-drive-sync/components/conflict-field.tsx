import type { CSSProperties } from 'react'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { Button } from '@/components/shadcn/button'
import { useConflictField } from '@/hooks/use-conflict-field'
import { cn } from '@/lib/utils'
import { formatValue } from './utils'

type Resolution = 'local' | 'remote'

interface ConflictFieldProps {
  pathKey: string
  indent: number
}

const STYLE_MAP = {
  local: {
    bg: 'bg-green-100/50 dark:bg-green-900/30',
    border: 'border-l-green-500',
    text: 'text-green-600 dark:text-green-400',
    hover: 'hover:bg-green-200/50 dark:hover:bg-green-900/50',
    selected: 'bg-green-200/60 dark:bg-green-900/40',
    badge: 'bg-green-200/60 dark:bg-green-900/50',
    label: 'options.config.sync.googleDrive.conflict.localLatest',
  },
  remote: {
    bg: 'bg-blue-100/50 dark:bg-blue-900/30',
    border: 'border-l-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    hover: 'hover:bg-blue-200/50 dark:hover:bg-blue-900/50',
    selected: 'bg-blue-200/60 dark:bg-blue-900/40',
    badge: 'bg-blue-200/60 dark:bg-blue-900/50',
    label: 'options.config.sync.googleDrive.conflict.remoteLatest',
  },
  unresolved: {
    bg: 'bg-orange-100/50 dark:bg-orange-900/30',
    border: 'border-l-orange-500',
  },
} as const

interface OptionRowProps {
  type: Resolution
  value: unknown
  isSelected: boolean
  fieldKey: string
  showFieldKey: boolean
  onClick: () => void
}

function OptionRow({ type, value, isSelected, fieldKey, showFieldKey, onClick }: OptionRowProps) {
  const { text, hover, selected, badge, label } = STYLE_MAP[type]
  const isComplexValue = typeof value === 'object' && value !== null

  return (
    <div
      className={cn('flex cursor-pointer py-1 ps-(--indent)', hover, isSelected && selected, isComplexValue ? 'flex-col items-start gap-1' : 'items-center')}
      onClick={onClick}
    >
      <div className="flex items-center text-sm">
        <span className={cn('px-2 py-0.5 rounded mr-2 shrink-0', text, badge)}>
          {i18n.t(label)}
        </span>
        {showFieldKey && (
          <>
            <span className={text}>
              "
              {fieldKey}
              "
            </span>
            <span className="text-slate-500 mx-1">:</span>
          </>
        )}
        {!isComplexValue && (
          <span className="text-slate-700 dark:text-slate-300">{formatValue(value)}</span>
        )}
        {isSelected && <Icon icon="mdi:check-circle" className={cn('size-4 ml-2', text)} />}
      </div>
      {isComplexValue && (
        <pre className="text-slate-700 dark:text-slate-300 text-xs ml-4 max-h-40 overflow-auto whitespace-pre-wrap break-all">
          {formatValue(value)}
        </pre>
      )}
    </div>
  )
}

export function ConflictField({ pathKey, indent }: ConflictFieldProps) {
  const { conflict, resolution, selectLocal, selectRemote, reset } = useConflictField(pathKey)

  if (!conflict)
    return null

  const fieldKey = conflict.path.at(-1) ?? ''
  const showFieldKey = Number.isNaN(Number(fieldKey))
  const containerStyle = resolution ? STYLE_MAP[resolution] : STYLE_MAP.unresolved

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
        <Icon icon="mdi:alert" className="size-4 text-orange-500 dark:text-orange-400 shrink-0 mr-2" />
        <span className="text-orange-600 dark:text-orange-300 text-xs font-semibold">
          {i18n.t('options.config.sync.googleDrive.conflict.conflictPrompt')}
        </span>
        {resolution && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 ml-2"
            onClick={reset}
          >
            <Icon icon="mdi:undo" className="size-3 mr-1" />
            {i18n.t('options.config.sync.googleDrive.conflict.reset')}
          </Button>
        )}
      </div>

      {options.map(({ type, value, onClick }) => (
        <OptionRow
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
