import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import TranslateProviderSelector from '@/components/llm-providers/translate-provider-selector'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/base-ui/tooltip'

export default function TranslateProviderField() {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium flex items-center gap-1.5">
        {i18n.t('translateService.title')}
        <Tooltip>
          <TooltipTrigger render={<Icon icon="tabler:help" className="size-3 text-blue-300 dark:text-blue-700/70" />} />
          <TooltipContent>
            <p>
              {i18n.t('translateService.description')}
            </p>
          </TooltipContent>
        </Tooltip>
      </span>
      <TranslateProviderSelector className="h-7! w-31 cursor-pointer pr-1.5 pl-2.5" />
    </div>
  )
}
