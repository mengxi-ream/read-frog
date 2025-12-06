import { i18n } from '#imports'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { Field, FieldContent, FieldLabel } from '@/components/shadcn/field'
import { Hint } from '@/components/shadcn/hint'
import { Switch } from '@/components/shadcn/switch'
import { configFieldsAtomMap } from '@/utils/atoms/config'

export function CustomTranslationStyleSwitch() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { translationNodeStyle } = translateConfig

  return (
    <Field orientation="horizontal">
      <FieldContent className="self-center">
        <FieldLabel htmlFor="custom-style-toggle">
          {i18n.t('options.translation.translationStyle.useCustomStyle')}
          <Hint content={i18n.t('options.translation.translationStyle.useCustomStyleDescription')} />
        </FieldLabel>
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
