import { i18n } from '#imports'
import { Icon } from '@iconify/react/dist/iconify.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import { toast } from 'sonner'
import { Button } from '@/components/shadcn/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/shadcn/empty'
import { ConfigCard } from '@/entrypoints/options/components/config-card'
import { configAtom } from '@/utils/atoms/config'
import { addBackup, getAllBackupsWithMetadata } from '@/utils/backup/storage'
import { EXTENSION_VERSION } from '@/utils/constants/app'
import { MAX_BACKUPS_COUNT } from '@/utils/constants/backup'
import { queryClient } from '@/utils/tanstack-query'
import { BackupConfigItem } from './components/backup-config-item'

export function ConfigBackup() {
  const { data: backupsWithMetadata, isPending } = useQuery({
    queryKey: ['config-backups'],
    queryFn: () => getAllBackupsWithMetadata(),
  })

  return (
    <ConfigCard
      title={i18n.t('options.config.backup.title')}
      description={i18n.t('options.config.backup.description', [MAX_BACKUPS_COUNT])}
    >
      <div className="space-y-4">
        {isPending && (
          <div className="text-center text-muted-foreground py-8">
            {i18n.t('options.config.backup.loading')}
          </div>
        )}

        {backupsWithMetadata && backupsWithMetadata?.length === 0 && (
          <EmptyState />
        )}
        {backupsWithMetadata && backupsWithMetadata?.length > 0 && (
          <>
            <Toolbar />
            {backupsWithMetadata.map(backupWithMetadata => (
              <BackupConfigItem
                key={backupWithMetadata.id}
                backupId={backupWithMetadata.id}
                backupMetadata={backupWithMetadata.metadata}
                backup={{
                  schemaVersion: backupWithMetadata.schemaVersion,
                  config: backupWithMetadata.config,
                }}
              />
            ))}
          </>
        )}
      </div>
    </ConfigCard>
  )
}

function Toolbar() {
  const currentConfig = useAtomValue(configAtom)
  const { mutate: backupConfig, isPending: isBackingUp } = useMutation({
    mutationFn: async () => {
      await addBackup(currentConfig, EXTENSION_VERSION)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config-backups'] })
      toast.success(i18n.t('options.config.backup.backupSuccess'))
    },
  })
  return (
    <div className="flex justify-end">
      <Button disabled={isBackingUp} onClick={() => backupConfig()}>
        <Icon icon="tabler:plus" />
        {i18n.t('options.config.backup.backupNow')}
      </Button>
    </div>
  )
}

function EmptyState() {
  const currentConfig = useAtomValue(configAtom)
  const { mutate: backupConfig, isPending: isBackingUp } = useMutation({
    mutationFn: async () => {
      await addBackup(currentConfig, EXTENSION_VERSION)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config-backups'] })
      toast.success(i18n.t('options.config.backup.backupSuccess'))
    },
  })
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon icon="tabler:file-off" />
        </EmptyMedia>
        <EmptyTitle>{i18n.t('options.config.backup.empty.title')}</EmptyTitle>
        <EmptyDescription>
          {i18n.t('options.config.backup.empty.description')}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" size="sm" disabled={isBackingUp} onClick={() => backupConfig()}>
          {i18n.t('options.config.backup.backupNow')}
        </Button>
      </EmptyContent>
    </Empty>
  )
}
