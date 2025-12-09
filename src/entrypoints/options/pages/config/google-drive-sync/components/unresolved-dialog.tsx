import type { Config } from '@/types/config/config'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useMemo, useState } from 'react'
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
  resolvedConfigAtom,
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
  const resolvedConfig = useAtomValue(resolvedConfigAtom)
  const status = useAtomValue(resolutionStatusAtom)
  const selectAllLocal = useSetAtom(selectAllLocalAtom)
  const selectAllRemote = useSetAtom(selectAllRemoteAtom)
  const { query: { data: authData } } = useGoogleDriveAuth()

  const email = useMemo(() => authData?.userInfo?.email, [authData])

  const handleConfirm = async () => {
    if (!resolvedConfig?.config || !unresolvedConfigs || !email)
      return
    setIsConfirming(true)
    try {
      await syncMergedConfig(resolvedConfig.config, email)
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
          {status.conflictCount > 0 && (
            <span>
              {i18n.t('options.config.sync.googleDrive.unresolved.progress', [
                status.allResolved ? status.conflictCount : status.resolvedCount,
                status.conflictCount,
              ])}
            </span>
          )}
          {status.hasValidationError
            ? (
                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                  <Icon icon="mdi:alert-circle" className="size-4" />
                  {i18n.t('options.config.sync.googleDrive.unresolved.configInvalid')}
                </span>
              )
            : status.isValid
              ? (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <Icon icon="mdi:check-circle" className="size-4" />
                    {i18n.t('options.config.sync.googleDrive.unresolved.configValid')}
                  </span>
                )
              : null}
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
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-xs">
          <div className="flex items-start gap-2">
            <Icon icon="mdi:alert-circle" className="size-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-800 dark:text-red-200">
                {i18n.t('options.config.sync.googleDrive.unresolved.validationError')}
              </p>
              <ul className="mt-1 text-red-700 dark:text-red-300 list-disc list-inside">
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
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-scroll">
        {resolvedConfig?.config && (
          <MergeConfigView mergedConfig={resolvedConfig.config} />
        )}
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

interface MergedConfigViewProps {
  mergedConfig: Config
}

function MergeConfigView({ mergedConfig }: MergedConfigViewProps) {
  return (
    <div className="h-full rounded-lg overflow-hidden flex flex-col bg-slate-100 dark:bg-slate-900">
      <div className="px-4 py-2 flex items-center gap-4 text-xs border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-slate-700 dark:text-slate-300">{i18n.t('options.config.sync.googleDrive.unresolved.title')}</span>
        </div>
        <div className="flex items-center gap-4 ml-auto text-slate-600 dark:text-slate-400">
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
      <div className="flex-1 overflow-auto">
        <JsonTreeView data={mergedConfig} />
      </div>
    </div>
  )
}
