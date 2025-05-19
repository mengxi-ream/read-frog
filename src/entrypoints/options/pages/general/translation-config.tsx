import type { PageTranslateRange } from '@/types/config/provider'

import deepmerge from 'deepmerge'
import { useAtom } from 'jotai'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { pageTranslateRangeSchema } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export default function TranslationConfig() {
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)
  return (
    <ConfigCard title="Translation Config" description="Only for translation within web pages, such as bilingual paragraph translation.">
      <div className="grid w-[220px] items-center gap-0.5">
        <label className="text-sm font-medium">
          {i18n.t('options.translationConfig.translateRange.title')}
        </label>
        <Select
          value={translateConfig.page.range}
          onValueChange={(value: PageTranslateRange) =>
            setTranslateConfig(
              deepmerge(translateConfig, { page: { range: value } }),
            )}
        >
          <SelectTrigger className="mt-1 w-full">
            <SelectValue asChild>
              <span>
                {i18n.t(
                  `options.translationConfig.translateRange.range.${translateConfig.page.range}`,
                )}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {pageTranslateRangeSchema.options.map(range => (
                <SelectItem key={range} value={range}>
                  {i18n.t(
                    `options.translationConfig.translateRange.range.${range}`,
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </ConfigCard>
  )
}
