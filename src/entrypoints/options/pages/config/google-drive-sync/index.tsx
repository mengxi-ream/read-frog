import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/shadcn/button'
import { conflictDataAtom, conflictResolutionsAtom } from '@/utils/atoms/google-drive-sync'
import { lastSyncTimeAtom } from '@/utils/atoms/last-sync-time'
import { clearAccessToken, isAuthenticated } from '@/utils/google-drive/auth'
import { ConfigConflictError, syncConfig } from '@/utils/google-drive/sync'
import { logger } from '@/utils/logger'
import { ConfigCard } from '../../../components/config-card'
import { ConflictResolutionDialog } from './components/conflict-resolution-dialog'

export function GoogleDriveSyncCard() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const setConflictData = useSetAtom(conflictDataAtom)
  const setConflictResolutions = useSetAtom(conflictResolutionsAtom)
  const lastSyncTime = useAtomValue(lastSyncTimeAtom)

  const checkAuthStatus = async () => {
    const authenticated = await isAuthenticated()
    setIsLoggedIn(authenticated)
  }

  useEffect(() => {
    void checkAuthStatus()
  }, [])

  const handleSync = async () => {
    setIsSyncing(true)

    try {
      await syncConfig()
      await checkAuthStatus()
      toast.success(i18n.t('options.config.sync.googleDrive.syncSuccess'))
    }
    catch (error) {
      if (error instanceof ConfigConflictError) {
        logger.info('Conflict detected, opening resolution dialog')
        setConflictData(error.data)
        setIsOpen(true)
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
    setIsLoggedIn(false)
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
        <div className="w-full flex flex-col items-end gap-2">
          <div className="flex gap-2">
            {isLoggedIn && (
              <Button variant="outline" onClick={handleLogout}>
                {i18n.t('options.config.sync.googleDrive.logout')}
              </Button>
            )}
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
      </ConfigCard>

      <ConflictResolutionDialog
        open={isOpen}
        onResolved={() => handleDialogClose(true)}
        onCancelled={() => handleDialogClose(false)}
      />
    </>
  )
}
