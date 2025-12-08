import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/shadcn/button'
import { useGoogleDriveAuth } from '@/hooks/use-google-drive-auth'
import { conflictDataAtom, conflictResolutionsAtom } from '@/utils/atoms/google-drive-sync'
import { lastSyncTimeAtom } from '@/utils/atoms/last-sync-time'
import { clearAccessToken } from '@/utils/google-drive/auth'
import { ConfigConflictOrNotValidError, syncConfig, SyncMetadataCorruptedError } from '@/utils/google-drive/sync'
import { logger } from '@/utils/logger'
import { ConfigCard } from '../../../components/config-card'
import { ConflictResolutionDialog } from './components/conflict-resolution-dialog'

export function GoogleDriveSyncCard() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const { query: { data: authData }, invalidate: refreshAuthData } = useGoogleDriveAuth()
  const setConflictData = useSetAtom(conflictDataAtom)
  const setConflictResolutions = useSetAtom(conflictResolutionsAtom)
  const lastSyncTime = useAtomValue(lastSyncTimeAtom)

  const handleSync = async () => {
    setIsSyncing(true)

    try {
      await syncConfig()
      void refreshAuthData()
      toast.success(i18n.t('options.config.sync.googleDrive.syncSuccess'))
    }
    catch (error) {
      if (error instanceof ConfigConflictOrNotValidError) {
        logger.info('Conflict detected, opening resolution dialog')
        setConflictData(error.data)
        setIsOpen(true)
      }
      else if (error instanceof SyncMetadataCorruptedError) {
        logger.warn('Sync metadata corrupted, remote config applied')
        toast.warning(i18n.t('options.config.sync.googleDrive.metadataCorrupted'))
      }
      else {
        logger.error('Google Drive sync error from UI', error)
        toast.error(i18n.t('options.config.sync.googleDrive.syncError'))
      }
    }
    finally {
      setIsSyncing(false)
    }
  }

  const handleLogout = async () => {
    await clearAccessToken()
    void refreshAuthData()
    toast.success(i18n.t('options.config.sync.googleDrive.logoutSuccess'))
  }

  const handleDialogClose = (success: boolean) => {
    setIsOpen(false)
    setConflictResolutions({})
    if (success) {
      toast.success(i18n.t('options.config.sync.googleDrive.syncSuccess'))
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
        description={i18n.t('options.config.sync.googleDrive.description')}
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
            {lastSyncTime && (
              <span className="text-xs text-muted-foreground">
                {i18n.t('options.config.sync.googleDrive.lastSyncTime')}
                :
                {' '}
                {formatLastSyncTime(lastSyncTime)}
              </span>
            )}
          </div>
          {authData?.isAuthenticated && authData.userInfo && (
            <div className="flex items-center gap-2">
              {authData.userInfo.picture && (
                <img src={authData.userInfo.picture} alt="Google Account" className="size-5 border rounded-full" />
              )}
              <span className="text-sm text-muted-foreground">{authData.userInfo.email}</span>
              <Button variant="outline" onClick={handleLogout}>
                {i18n.t('options.config.sync.googleDrive.logout')}
              </Button>
            </div>
          )}
        </div>
      </ConfigCard>

      <ConflictResolutionDialog
        open={isOpen}
        onResolved={() => handleDialogClose(true)}
        onCancelled={() => handleDialogClose(false)}
      />
    </>
  )
}
