import { i18n } from '#imports'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { Field, FieldLabel } from '@/components/ui/base-ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/base-ui/select'
import { pageTranslateRangeSchema } from '@/types/config/translate'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function TranslateRange() {
  return (
    <ConfigCard title={i18n.t('options.translation.translateRange.title')} description={i18n.t('options.translation.translateRange.description')}>
      <TranslateRangeSelector />
    </ConfigCard>
  )
}

function TranslateRangeSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t('options.translation.translateRange.title')}
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
              `options.translation.translateRange.range.${translateConfig.page.range}`,
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {pageTranslateRangeSchema.options.map(range => (
              <SelectItem key={range} value={range}>
                {i18n.t(
                  `options.translation.translateRange.range.${range}`,
                )}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}
