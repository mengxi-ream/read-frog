import type { TranslateProvider } from '@/types/config/provider'

import { useAtom } from 'jotai'
import { CircleHelp } from 'lucide-react'
import ProviderIcon from '@/components/provider-icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { configFields } from '@/utils/atoms/config'
import { TRANSLATE_PROVIDER_ITEMS } from '@/utils/constants/config'

export default function TranslateProviderSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium flex items-center gap-1.5">
        {i18n.t('translateService.title')}
        <Tooltip>
          <TooltipTrigger asChild>
            <CircleHelp className="size-3 text-blue-300 dark:text-blue-700/70" />
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
        onValueChange={(value: TranslateProvider) => {
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
          {Object.entries(TRANSLATE_PROVIDER_ITEMS).map(([value, { logo, name }]) => (
            <SelectItem key={value} value={value}>
              <ProviderIcon logo={logo} name={name} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
