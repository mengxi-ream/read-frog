import { i18n } from '#imports'
import { PageLayout } from '../../components/page-layout'
import { BetaExperienceConfig } from './beta-experience'
import { ConfigBackup } from './config-backup'
import { GoogleDriveSyncCard } from './google-drive-sync'
import { ManualConfigSync } from './manual-config-sync'
import { ResetConfig } from './reset-config'

export function ConfigPage() {
  return (
    <PageLayout title={i18n.t('options.config.title')} innerClassName="*:border-b [&>*:last-child]:border-b-0">
      <BetaExperienceConfig />
      <GoogleDriveSyncCard />
      <ManualConfigSync />
      <ConfigBackup />
      <ResetConfig />
    </PageLayout>
  )
}
