import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { NewBadge } from '@/components/badges/new-badge'
import { Switch } from '@/components/base-ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/base-ui/tooltip'
import { configFieldsAtomMap } from '@/utils/atoms/config'

export function AISmartContext() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-[13px] font-medium">
        {i18n.t('popup.aiSmartContext')}
        <NewBadge size="sm" />
        <Tooltip>
          <TooltipTrigger
            render={<Icon icon="tabler:help" className="size-3 text-blue-300 dark:text-blue-700/70" />}
          />
          <TooltipContent className="w-44">
            <p>
              {i18n.t('popup.aiSmartContextDescription')}
            </p>
          </TooltipContent>
        </Tooltip>
      </span>
      <Switch
        checked={translateConfig.enableAIContentAware}
        onCheckedChange={checked =>
          setTranslateConfig(deepmerge(translateConfig, { enableAIContentAware: checked }))}
      />
    </div>
  )
}
