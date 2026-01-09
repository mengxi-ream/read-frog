import { i18n } from '#imports'
import { PageLayout } from '../../components/page-layout'
import { AutoStartSubtitlesToggle } from './auto-start-subtitles-toggle'
import { VideoSubtitlesToggle } from './video-subtitles-toggle'

export function VideoSubtitlesPage() {
  return (
    <PageLayout title={i18n.t('options.videoSubtitles.title')}>
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <VideoSubtitlesToggle />
        <AutoStartSubtitlesToggle />
      </div>
    </PageLayout>
  )
}
