import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { Activity, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/shadcn/button'
import { useGoogleDriveAuth } from '@/hooks/use-google-drive-auth'
import { resolutionsAtom, unresolvedConfigsAtom } from '@/utils/atoms/google-drive-sync'
import { lastSyncTimeAtom } from '@/utils/atoms/last-sync-time'
import { clearAccessToken } from '@/utils/google-drive/auth'
import { syncConfig } from '@/utils/google-drive/sync'
import { logger } from '@/utils/logger'
import { ConfigCard } from '../../../components/config-card'
import { UnresolvedDialog } from './components/unresolved-dialog'

export function GoogleDriveSyncCard() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const { query: { data: authData }, invalidate: invalidateAuthData } = useGoogleDriveAuth()
  const setUnresolvedData = useSetAtom(unresolvedConfigsAtom)
  const setResolutions = useSetAtom(resolutionsAtom)
  const lastSyncTime = useAtomValue(lastSyncTimeAtom)

  const handleSync = async () => {
    setIsSyncing(true)

    const result = await syncConfig()

    if (result.status === 'unresolved') {
      setUnresolvedData(result.data)
      setIsOpen(true)
    }
    else if (result.status === 'success') {
      const messages = {
        'uploaded': i18n.t('options.config.sync.googleDrive.syncSuccess.uploaded'),
        'downloaded': i18n.t('options.config.sync.googleDrive.syncSuccess.downloaded'),
        'same-changes': i18n.t('options.config.sync.googleDrive.syncSuccess.sameChanges'),
        'no-change': i18n.t('options.config.sync.googleDrive.syncSuccess.noChange'),
      } as const
      toast.success(messages[result.action])
    }
    else {
      logger.error('Google Drive sync error', result.error)
      toast.error(i18n.t('options.config.sync.googleDrive.syncError'), {
        description: result.error.message,
      })
    }

    setIsSyncing(false)
  }

  const handleLogout = async () => {
    await clearAccessToken()
    void invalidateAuthData()
    toast.success(i18n.t('options.config.sync.googleDrive.logoutSuccess'))
  }

  const handleDialogClose = (success: boolean) => {
    setIsOpen(false)
    setResolutions({})
    if (success) {
      toast.success(i18n.t('options.config.sync.googleDrive.syncSuccess.unresolved'))
    }
    else {
      toast.error(i18n.t('options.config.sync.googleDrive.syncError'))
    }
  }

  const formatLastSyncTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <>
      <ConfigCard
        title={i18n.t('options.config.sync.googleDrive.title')}
        description={(
          <div className="flex flex-col gap-2">
            {i18n.t('options.config.sync.googleDrive.description')}
            <Activity mode={authData?.isAuthenticated ? 'visible' : 'hidden'}>
              <div className="flex items-center gap-2 text-sm">
                {authData?.userInfo?.picture && (
                  <img src={authData.userInfo.picture} alt="Google Account" className="size-5 border rounded-full" />
                )}
                <span className="text-sm text-muted-foreground">{authData?.userInfo?.email}</span>
              </div>
            </Activity>
          </div>
        )}
      >
        <div className="w-full flex flex-col items-end gap-4">
          <div className="flex flex-col gap-2 items-end">
            <div className="flex gap-2">
              <Button
                onClick={handleSync}
                disabled={isSyncing}
              >
                <Icon icon="logos:google-drive" className="size-4" />
                {isSyncing
                  ? i18n.t('options.config.sync.googleDrive.syncing')
                  : i18n.t('options.config.sync.googleDrive.sync')}
              </Button>
            </div>
            <Activity mode={lastSyncTime ? 'visible' : 'hidden'}>
              <span className="text-xs text-muted-foreground">
                {i18n.t('options.config.sync.googleDrive.lastSyncTime')}
                :
                {' '}
                {lastSyncTime && formatLastSyncTime(lastSyncTime)}
              </span>
            </Activity>
          </div>
          <Activity mode={authData?.isAuthenticated ? 'visible' : 'hidden'}>
            <Button variant="outline" onClick={handleLogout}>
              {i18n.t('options.config.sync.googleDrive.logout')}
            </Button>
          </Activity>
        </div>
      </ConfigCard>

      <UnresolvedDialog
        open={isOpen}
        onResolved={() => handleDialogClose(true)}
        onCancelled={() => handleDialogClose(false)}
      />
    </>
  )
}
