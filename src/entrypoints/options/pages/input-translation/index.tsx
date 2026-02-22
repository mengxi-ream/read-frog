import { i18n } from '#imports'
import { PageLayout } from '../../components/page-layout'
import { InputTranslationLanguages } from './input-translation-languages'
import { InputTranslationThreshold } from './input-translation-threshold'
import { InputTranslationToggle } from './input-translation-toggle'

export function InputTranslationPage() {
  return (
    <PageLayout title={i18n.t('options.overlayTools.inputTranslation.title')}>
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <InputTranslationToggle />
        <InputTranslationLanguages />
        <InputTranslationThreshold />
      </div>
    </PageLayout>
  )
}
