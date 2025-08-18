import type { TranslateProviderNames } from '@/types/config/provider'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/components/tooltip'
import { useAtom } from 'jotai'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/browser-adaptive-select'
import ProviderIcon from '@/components/provider-icon'
import { configFields } from '@/utils/atoms/config'
import { LLM_TRANSLATE_PROVIDER_ITEMS, PURE_TRANSLATE_PROVIDER_ITEMS } from '@/utils/constants/config'

export default function TranslateProviderSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium flex items-center gap-1.5">
        {i18n.t('translateService.title')}
        <Tooltip>
          <TooltipTrigger asChild>
            <Icon icon="tabler:help" className="size-3 text-blue-300 dark:text-blue-700/70" />
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {i18n.t('translateService.description')}
            </p>
          </TooltipContent>
        </Tooltip>
      </span>
      <Select
        value={translateConfig.provider}
        onValueChange={(value: TranslateProviderNames) => {
          setTranslateConfig({
            ...translateConfig,
            provider: value,
          })
        }}
      >
        <SelectTrigger className="bg-input/50 hover:bg-input !h-7 w-31 cursor-pointer pr-1.5 pl-2.5 outline-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{i18n.t('translateService.aiTranslator')}</SelectLabel>
            {Object.entries(LLM_TRANSLATE_PROVIDER_ITEMS).map(([value, { logo, name }]) => (
              <SelectItem key={value} value={value}>
                <ProviderIcon logo={logo} name={name} />
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>{i18n.t('translateService.normalTranslator')}</SelectLabel>
            {Object.entries(PURE_TRANSLATE_PROVIDER_ITEMS).map(([value, { logo, name }]) => (
              <SelectItem key={value} value={value}>
                <ProviderIcon logo={logo} name={name} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
