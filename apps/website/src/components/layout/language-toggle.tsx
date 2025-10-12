'use client'
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { buttonVariants } from '@repo/ui/components/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui/components/popover'
import { cn } from '@repo/ui/lib/utils'
import { useI18n } from 'fumadocs-ui/contexts/i18n'

// TODO: Remove 'popover' Omit when Radix UI supports React 19.2
// React 19.2 added "hint" value to popover attribute, but Radix UI doesn't support it yet
export type LanguageSelectProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'popover'>

export function LanguageToggle(props: LanguageSelectProps): React.ReactElement {
  const context = useI18n()
  if (!context.locales)
    throw new Error('Missing `<I18nProvider />`')

  return (
    <Popover>
      <PopoverTrigger
        aria-label={context.text.chooseLanguage}
        {...props}
        className={cn(
          buttonVariants({
            variant: 'ghost',
            className: 'gap-1.5 p-1.5',
          }),
          props.className,
        )}
      >
        {props.children}
      </PopoverTrigger>
      <PopoverContent className="flex flex-col overflow-hidden p-0">
        <p className="mb-1 p-2 text-xs font-medium text-fd-muted-foreground">
          {context.text.chooseLanguage}
        </p>
        {context.locales.map(item => (
          <button
            key={item.locale}
            type="button"
            className={cn(
              'p-2 text-start text-sm',
              item.locale === context.locale
                ? 'bg-fd-primary/10 font-medium text-fd-primary'
                : 'hover:bg-fd-accent hover:text-fd-accent-foreground',
            )}
            onClick={() => {
              context.onChange?.(item.locale)
            }}
          >
            {item.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export function LanguageToggleText(
  props: HTMLAttributes<HTMLSpanElement>,
): React.ReactElement {
  const context = useI18n()
  const text = context.locales?.find(
    item => item.locale === context.locale,
  )?.name

  return <span {...props}>{text}</span>
}
