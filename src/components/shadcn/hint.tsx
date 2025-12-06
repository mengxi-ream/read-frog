import type { ComponentProps } from 'react'
import { IconHelpCircle } from '@tabler/icons-react'
import { cn } from '@/utils/styles/tailwind'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

type HintProps = {
  content: string
} & Omit<ComponentProps<typeof TooltipContent>, 'children'>

export function Hint({ content, className, ...props }: HintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <IconHelpCircle className="size-3.5 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent className={cn('max-w-64', className)} {...props}>
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
