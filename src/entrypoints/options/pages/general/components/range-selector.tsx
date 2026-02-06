import { i18n } from '#imports'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { Field, FieldLabel } from '@/components/ui/base-ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/base-ui/select'
import { pageTranslateRangeSchema } from '@/types/config/translate'
import { configFieldsAtomMap } from '@/utils/atoms/config'

export function RangeSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t('options.general.translationConfig.translateRange.title')}
      </FieldLabel>
      <Select
        value={translateConfig.page.range}
        onValueChange={(value) => {
          if (!value)
            return
          void setTranslateConfig(
            deepmerge(translateConfig, { page: { range: value } }),
          )
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue>
            {i18n.t(
              `options.general.translationConfig.translateRange.range.${translateConfig.page.range}`,
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {pageTranslateRangeSchema.options.map(range => (
              <SelectItem key={range} value={range}>
                {i18n.t(
                  `options.general.translationConfig.translateRange.range.${range}`,
                )}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}
