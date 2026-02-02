import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/base-ui/tooltip'
import ReadProviderSelector from '@/components/llm-providers/read-provider-selector'

export default function ReadProviderField() {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium flex items-center gap-1.5">
        {i18n.t('readService.title')}
        <Tooltip>
          <TooltipTrigger render={<Icon icon="tabler:help" className="size-3 text-blue-300 dark:text-blue-700/70" />} />
          <TooltipContent>
            <p>
              {i18n.t('readService.description')}
            </p>
          </TooltipContent>
        </Tooltip>
      </span>
      <ReadProviderSelector className="!h-7 w-31 cursor-pointer pr-1.5 pl-2.5" />
    </div>
  )
}
