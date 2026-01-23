import * as React from 'react'
import { Button } from '@/components/base-ui/button'
import { Textarea } from '@/components/shadcn/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip'
import { cn } from '@/utils/styles/utils'

interface InsertableTextareaHandle extends HTMLTextAreaElement {
  insertTextAtCursor: (text: string) => void
}

interface InsertableTextareaProps extends Omit<React.ComponentProps<'textarea'>, 'ref'> {
  ref?: React.Ref<InsertableTextareaHandle>
}

interface InsertCell {
  text: string
  description: string
}

interface QuickInsertableTextareaProps extends Omit<React.ComponentProps<'textarea'>, 'ref'> {
  ref?: React.Ref<InsertableTextareaHandle>
  insertCells?: InsertCell[]
  cellsClassName?: string
  cellClassName?: string
  containerClassName?: string
}

function InsertableTextarea({ className, ref, ...props }: InsertableTextareaProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  React.useImperativeHandle(ref, () => {
    const textarea = textareaRef.current
    if (!textarea)
      throw new Error('Textarea ref is null')

    return {
      ...textarea,
      insertTextAtCursor(text: string) {
        const textarea = textareaRef.current
        if (!textarea)
          return

        const { selectionStart, selectionEnd, value } = textarea
        const newValue = value.slice(0, selectionStart) + text + value.slice(selectionEnd)

        // Get the native value setter to bypass React's control
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value',
        )?.set

        if (nativeInputValueSetter) {
          // Use the native setter to avoid React's internal tracking conflicts
          nativeInputValueSetter.call(textarea, newValue)
          textarea.dispatchEvent(new Event('input', { bubbles: true }))
        }

        const newCursorPos = selectionStart + text.length
        textarea.setSelectionRange(newCursorPos, newCursorPos)
        textarea.focus()
      },
    }
  }, [])

  return (
    <Textarea
      ref={textareaRef}
      className={className}
      {...props}
    />
  )
}

const DEFAULT_INSERT_CELLS: InsertCell[] = []

function QuickInsertableTextarea({ className, insertCells = DEFAULT_INSERT_CELLS, cellsClassName, cellClassName, containerClassName, ...props }: QuickInsertableTextareaProps) {
  const textareaRef = React.useRef<InsertableTextareaHandle>(null)

  const handleCellClick = (cellText: string) => {
    textareaRef.current?.insertTextAtCursor(cellText)
  }

  if (insertCells.length === 0) {
    return (
      <InsertableTextarea
        ref={textareaRef}
        className={className}
        {...props}
      />
    )
  }

  return (
    <div className={cn('space-y-2 w-full min-w-0', containerClassName)}>
      <InsertableTextarea
        ref={textareaRef}
        className={className}
        {...props}
      />
      <div className={cn(
        'flex flex-wrap gap-2',
        cellsClassName,
      )}
      >
        {insertCells.map(cell => (
          <Tooltip key={cell.text}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 px-3 text-xs font-medium',
                  cellClassName,
                )}
                onClick={() => handleCellClick(cell.text)}
                disabled={props.disabled}
              >
                {cell.text}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{cell.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}

export { InsertableTextarea, QuickInsertableTextarea }
export type { InsertableTextareaHandle, InsertableTextareaProps, InsertCell, QuickInsertableTextareaProps }
