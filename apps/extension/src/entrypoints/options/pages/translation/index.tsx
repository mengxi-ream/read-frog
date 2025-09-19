import { i18n } from '#imports'
import { PageLayout } from '../../components/page-layout'
import { AutoTranslateLanguages } from './auto-translate-languages'
import { AutoTranslateWebsitePatterns } from './auto-translate-website-patterns'
import { ClearCacheConfig } from './clear-cache-config'
import { CustomAutoTranslateShortcutKey } from './custom-auto-translate-shortcut-key'
import { CustomTranslationStyle } from './custom-translation-style'
import { PersonalizedPrompts } from './personalized-prompt'
import { RequestBatch } from './request-batch'
import { RequestRate } from './request-rate'
import { TranslationMode } from './translation-mode'

export function TranslationPage() {
  return (
    <PageLayout title={i18n.t('options.translation.title')} innerClassName="[&>*]:border-b [&>*:last-child]:border-b-0">
      <TranslationMode />
      <CustomAutoTranslateShortcutKey />
      <RequestRate />
      <RequestBatch />
      <CustomTranslationStyle />
      <AutoTranslateWebsitePatterns />
      <AutoTranslateLanguages />
      <PersonalizedPrompts />
      <ClearCacheConfig />
    </PageLayout>
  )
}
