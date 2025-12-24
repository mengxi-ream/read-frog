import type { ReactNode } from 'react'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/shadcn/collapsible'
import { FieldGroup } from '@/components/shadcn/field'
import { cn } from '@/utils/styles/tailwind'

interface AdvancedOptionsSectionProps {
  children: ReactNode
}

export function AdvancedOptionsSection({ children }: AdvancedOptionsSectionProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer py-2">
        <Icon
          icon="tabler:chevron-right"
          className={cn(
            'size-4 transition-transform duration-200',
            isOpen && 'rotate-90',
          )}
        />
        <span>{i18n.t('options.apiProviders.form.advancedOptions')}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <FieldGroup className="pt-4">
          {children}
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  )
}
