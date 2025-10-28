import { i18n } from '#imports'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@repo/ui/components/field'
import { Switch } from '@repo/ui/components/switch'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { configFieldsAtomMap } from '@/utils/atoms/config'

export function CustomTranslationStyleSwitch() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { translationNodeStyle } = translateConfig

  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor="custom-style-toggle">{i18n.t('options.translation.translationStyle.useCustomStyle')}</FieldLabel>
        <FieldDescription>
          {i18n.t('options.translation.translationStyle.useCustomStyleDescription')}
        </FieldDescription>
      </FieldContent>
      <Switch
        id="custom-style-toggle"
        checked={translationNodeStyle.isCustom}
        onCheckedChange={(isCustom) => {
          void setTranslateConfig(
            deepmerge(translateConfig, {
              translationNodeStyle: { isCustom },
            }),
          )
        }}
      />
    </Field>
  )
}
