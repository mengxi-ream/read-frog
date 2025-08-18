import type { ReadProviderNames } from '@/types/config/provider'

import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@repo/ui/components/tooltip'
import { useAtom } from 'jotai'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/browser-adaptive-select'
import ProviderIcon from '@/components/provider-icon'
import { configFields } from '@/utils/atoms/config'
import { READ_PROVIDER_ITEMS } from '@/utils/constants/config'

export default function ReadProviderSelector() {
  const [readConfig, setReadConfig] = useAtom(configFields.read)

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium flex items-center gap-1.5">
        {i18n.t('readService.title')}
        <Tooltip>
          <TooltipTrigger asChild>
            <Icon icon="tabler:help" className="size-3 text-blue-300 dark:text-blue-700/70" />
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {i18n.t('readService.description')}
            </p>
          </TooltipContent>
        </Tooltip>
      </span>
      <Select
        value={readConfig.provider}
        onValueChange={(value: ReadProviderNames) => {
          setReadConfig({
            ...readConfig,
            provider: value,
          })
        }}
      >
        <SelectTrigger className="bg-input/50 hover:bg-input !h-7 w-31 cursor-pointer pr-1.5 pl-2.5 outline-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(READ_PROVIDER_ITEMS).map(([value, { logo, name }]) => (
            <SelectItem key={value} value={value}>
              <ProviderIcon logo={logo} name={name} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
