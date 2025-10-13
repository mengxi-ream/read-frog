import { i18n } from '#imports'
import { PageLayout } from '../../components/page-layout'
import { TtsConfig } from './tts-config'

export function TextToSpeechPage() {
  return (
    <PageLayout title={i18n.t('options.tts.title')} innerClassName="[&>*]:border-b [&>*:last-child]:border-b-0">
      <TtsConfig />
    </PageLayout>
  )
}
