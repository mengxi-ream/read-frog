import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { Activity, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/shadcn/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shadcn/alert-dialog'
import { Button } from '@/components/shadcn/button'
import { useGoogleDriveAuth } from '@/hooks/use-google-drive-auth'
import {
  resolutionStatusAtom,
  resolvedConfigResultAtom,
  selectAllLocalAtom,
  selectAllRemoteAtom,
  unresolvedConfigsAtom,
} from '@/utils/atoms/google-drive-sync'
import { syncMergedConfig } from '@/utils/google-drive/sync'
import { logger } from '@/utils/logger'
import { JsonTreeView } from './json-tree-view'

interface UnresolvedDialogProps {
  open: boolean
  onResolved: () => void
  onCancelled: () => void
}

export function UnresolvedDialog({
  open,
  onResolved,
  onCancelled,
}: UnresolvedDialogProps) {
  return (
    <AlertDialog open={open}>
      <DialogContent
        onResolved={onResolved}
        onCancelled={onCancelled}
      />
    </AlertDialog>
  )
}

interface DialogContentProps {
  onResolved: () => void
  onCancelled: () => void
}

function DialogContent({ onResolved, onCancelled }: DialogContentProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const unresolvedConfigs = useAtomValue(unresolvedConfigsAtom)
  const resolvedConfigResult = useAtomValue(resolvedConfigResultAtom)
  const status = useAtomValue(resolutionStatusAtom)
  const selectAllLocal = useSetAtom(selectAllLocalAtom)
  const selectAllRemote = useSetAtom(selectAllRemoteAtom)
  const { query: { data: authData } } = useGoogleDriveAuth()

  const email = useMemo(() => authData?.userInfo?.email, [authData])

  const handleConfirm = async () => {
    if (!resolvedConfigResult?.config || !unresolvedConfigs) {
      return
    }
    if (!email) {
      toast.error('Email is not available')
      return
    }
    setIsConfirming(true)
    try {
      await syncMergedConfig(resolvedConfigResult.config, email)
      onResolved()
    }
    catch (error) {
      logger.error('Failed to sync merged config', error)
      onCancelled()
    }
    finally {
      setIsConfirming(false)
    }
  }

  const handleCancel = () => {
    logger.info('Conflict resolution cancelled')
    onCancelled()
  }

  const canConfirm = status.isValid && !isConfirming

  return (
    <AlertDialogContent className="md:max-w-2xl lg:max-w-4xl xl:max-w-5xl max-h-[90vh] flex flex-col">
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2">
          <Icon icon="mdi:alert" className="size-5 text-yellow-500" />
          {i18n.t('options.config.sync.googleDrive.unresolved.title')}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {i18n.t('options.config.sync.googleDrive.unresolved.description')}
        </AlertDialogDescription>
      </AlertDialogHeader>

      {/* Status bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 text-xs">
          {status.allResolved
            ? (!status.isValid
                ? (
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <Icon icon="tabler:alert-circle-filled" className="size-4" />
                      {i18n.t('options.config.sync.googleDrive.unresolved.configInvalid')}
                    </span>
                  )
                : (
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <Icon icon="tabler:circle-check-filled" className="size-4" />
                      {i18n.t('options.config.sync.googleDrive.unresolved.configValid')}
                    </span>
                  ))
            : (
                <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Icon icon="tabler:circle-dashed-check" className="size-4" />
                  {i18n.t('options.config.sync.googleDrive.unresolved.resolveToContinue')}
                </span>
              )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => selectAllLocal()}
            disabled={isConfirming}
          >
            <Icon icon="mdi:check-all" className="size-4 mr-1 text-green-600 dark:text-green-400" />
            {i18n.t('options.config.sync.googleDrive.unresolved.useAllLocal')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => selectAllRemote()}
            disabled={isConfirming}
          >
            <Icon icon="mdi:check-all" className="size-4 mr-1 text-blue-600 dark:text-blue-400" />
            {i18n.t('options.config.sync.googleDrive.unresolved.useAllRemote')}
          </Button>
        </div>
      </div>

      {/* Validation error display */}
      {status.validationError && (
        <Alert variant="destructive">
          <Icon icon="tabler:alert-circle-filled" className="size-4" />
          <AlertTitle>
            {i18n.t('options.config.sync.googleDrive.unresolved.validationAlert.title')}
          </AlertTitle>
          <AlertDescription>
            <p>{i18n.t('options.config.sync.googleDrive.unresolved.validationAlert.description')}</p>
            <ul className="list-disc list-inside text-xs">
              {status.validationError.issues.slice(0, 5).map(issue => (
                <li key={`${issue.path.join('.')}-${issue.message}`}>
                  <code className="text-xs">{issue.path.join('.')}</code>
                  {': '}
                  {issue.message}
                </li>
              ))}
              {status.validationError.issues.length > 5 && (
                <li>
                  {i18n.t('options.config.sync.googleDrive.unresolved.moreErrors', [
                    status.validationError.issues.length - 5,
                  ])}
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        <Activity mode={resolvedConfigResult?.config ? 'visible' : 'hidden'}>
          <MergeConfigView />
        </Activity>
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel disabled={isConfirming} onClick={handleCancel}>
          {i18n.t('options.config.sync.googleDrive.unresolved.cancel')}
        </AlertDialogCancel>
        <AlertDialogAction
          disabled={!canConfirm}
          onClick={(e) => {
            e.preventDefault()
            void handleConfirm()
          }}
        >
          {isConfirming
            ? i18n.t('options.config.sync.googleDrive.syncing')
            : i18n.t('options.config.sync.googleDrive.unresolved.confirm')}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  )
}

function MergeConfigView() {
  const resolvedConfigResult = useAtomValue(resolvedConfigResultAtom)
  const status = useAtomValue(resolutionStatusAtom)
  const resolvedConfig = resolvedConfigResult?.config
  if (!resolvedConfig)
    return null

  return (
    <div className="h-full rounded-lg overflow-hidden flex flex-col bg-muted">
      <div className="px-4 py-2 flex items-center gap-4 text-xs border-b bg-muted">
        {status.conflictCount > 0 && (
          <span className="text-zinc-700 dark:text-zinc-300">
            {i18n.t('options.config.sync.googleDrive.unresolved.progress', [
              status.allResolved ? status.conflictCount : status.resolvedCount,
              status.conflictCount,
            ])}
          </span>
        )}
        <div className="flex items-center gap-4 ml-auto text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>{i18n.t('options.config.sync.googleDrive.unresolved.localValue')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>{i18n.t('options.config.sync.googleDrive.unresolved.remoteValue')}</span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        <JsonTreeView resolvedConfig={resolvedConfig} />
      </div>
    </div>
  )
}
