import { i18n } from '#imports'
import { FieldGroup } from '@repo/ui/components/field'
import { ConfigCard } from '@/entrypoints/options/components/config-card'
import { CSSEditor } from './css-editor'
import { CustomTranslationStyleSwitch } from './custom-translation-style-switch'
import { PresetStyleSelector } from './preset-style-selector'
import { StylePreview } from './style-preview'

export function CustomTranslationStyle() {
  return (
    <ConfigCard title={i18n.t('options.translation.translationStyle.title')} description={i18n.t('options.translation.translationStyle.description')}>
      <FieldGroup>
        <CustomTranslationStyleSwitch />
        <PresetStyleSelector />
        <CSSEditor />
        <StylePreview />
      </FieldGroup>
    </ConfigCard>
  )
}
