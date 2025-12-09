import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { cn } from '@/lib/utils'
import { formatValue } from './utils'

type Resolution = 'local' | 'remote'

export const STYLE_MAP = {
  local: {
    bg: 'bg-green-100/50 dark:bg-green-900/30',
    border: 'border-l-green-500',
    text: 'text-green-600 dark:text-green-400',
    hover: 'hover:bg-green-200/50 dark:hover:bg-green-900/50',
    selected: 'bg-green-200/60 dark:bg-green-900/40',
    badge: 'bg-green-200/60 dark:bg-green-900/50',
    label: 'options.config.sync.googleDrive.unresolved.localLatest',
  },
  remote: {
    bg: 'bg-blue-100/50 dark:bg-blue-900/30',
    border: 'border-l-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    hover: 'hover:bg-blue-200/50 dark:hover:bg-blue-900/50',
    selected: 'bg-blue-200/60 dark:bg-blue-900/40',
    badge: 'bg-blue-200/60 dark:bg-blue-900/50',
    label: 'options.config.sync.googleDrive.unresolved.remoteLatest',
  },
  unresolved: {
    bg: 'bg-orange-100/50 dark:bg-orange-900/30',
    border: 'border-l-orange-500',
  },
} as const

interface FieldOptionRowProps {
  type: Resolution
  value: unknown
  isSelected: boolean
  fieldKey: string
  showFieldKey: boolean
  onClick: () => void
}

export function FieldOptionRow({ type, value, isSelected, fieldKey, showFieldKey, onClick }: FieldOptionRowProps) {
  const { text, hover, selected, badge, label } = STYLE_MAP[type]
  const isComplexValue = typeof value === 'object' && value !== null

  return (
    <div
      className={cn('flex cursor-pointer py-1 ps-(--indent) text-xs', hover, isSelected && selected, isComplexValue ? 'flex-col items-start gap-1' : 'items-center')}
      onClick={onClick}
    >
      <div className="flex items-center">
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
        <pre className="text-slate-700 dark:text-slate-300 ml-4 max-h-40 overflow-auto whitespace-pre-wrap break-all">
          {formatValue(value)}
        </pre>
      )}
    </div>
  )
}
