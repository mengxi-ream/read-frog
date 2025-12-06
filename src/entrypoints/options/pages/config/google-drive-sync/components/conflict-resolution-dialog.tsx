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
import {
  conflictResolutionsAtom,
  conflictStatusAtom,
  diffResultAtom,
  selectAllLocalAtom,
  selectAllRemoteAtom,
} from '@/utils/atoms/google-drive-sync'
import { applyResolutions } from '@/utils/google-drive/conflict-merge'
import { syncMergedConfig } from '@/utils/google-drive/sync'
import { logger } from '@/utils/logger'
import { JsonTreeView } from './json-tree-view'

interface ConflictResolutionDialogProps {
  open: boolean
  onResolved: () => void
  onCancelled: () => void
}

export function ConflictResolutionDialog({
  open,
  onResolved,
  onCancelled,
}: ConflictResolutionDialogProps) {
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
  const diffResult = useAtomValue(diffResultAtom)
  const resolutions = useAtomValue(conflictResolutionsAtom)
  const { resolved, total, allResolved } = useAtomValue(conflictStatusAtom)
  const selectAllLocal = useSetAtom(selectAllLocalAtom)
  const selectAllRemote = useSetAtom(selectAllRemoteAtom)

  const mergedConfig = useMemo(() => {
    if (!diffResult)
      return null
    return applyResolutions(diffResult, resolutions)
  }, [diffResult, resolutions])

  const handleConfirm = async () => {
    if (!mergedConfig)
      return
    setIsConfirming(true)
    try {
      await syncMergedConfig(mergedConfig)
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

  return (
    <AlertDialogContent className="md:max-w-2xl lg:max-w-4xl xl:max-w-5xl max-h-[90vh] flex flex-col">
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2">
          <Icon icon="mdi:alert" className="size-5 text-yellow-500" />
          {i18n.t('options.config.sync.googleDrive.conflict.title')}
        </AlertDialogTitle>
        <AlertDialogDescription className="flex items-center justify-between">
          <span>{i18n.t('options.config.sync.googleDrive.conflict.description')}</span>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <div className="flex items-center justify-between">
        <span className="text-xs">
          {i18n.t('options.config.sync.googleDrive.conflict.progress', [resolved, total])}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => selectAllLocal()}
            disabled={isConfirming}
          >
            <Icon icon="mdi:check-all" className="size-4 mr-1 text-green-600 dark:text-green-400" />
            {i18n.t('options.config.sync.googleDrive.conflict.useAllLocal')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => selectAllRemote()}
            disabled={isConfirming}
          >
            <Icon icon="mdi:check-all" className="size-4 mr-1 text-blue-600 dark:text-blue-400" />
            {i18n.t('options.config.sync.googleDrive.conflict.useAllRemote')}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-scroll">
        {mergedConfig && (
          <MergedConfigView mergedConfig={mergedConfig} />
        )}
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel disabled={isConfirming} onClick={handleCancel}>
          {i18n.t('options.config.sync.googleDrive.conflict.cancel')}
        </AlertDialogCancel>
        <AlertDialogAction
          disabled={!allResolved || isConfirming}
          onClick={(e) => {
            e.preventDefault()
            void handleConfirm()
          }}
        >
          {isConfirming
            ? i18n.t('options.config.sync.googleDrive.syncing')
            : i18n.t('options.config.sync.googleDrive.conflict.confirm')}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  )
}

interface MergedConfigViewProps {
  mergedConfig: Config
}

function MergedConfigView({ mergedConfig }: MergedConfigViewProps) {
  return (
    <div className="h-full rounded-lg overflow-hidden flex flex-col bg-slate-100 dark:bg-slate-900">
      <div className="px-4 py-2 flex items-center gap-4 text-xs border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-slate-700 dark:text-slate-300">{i18n.t('options.config.sync.googleDrive.conflict.title')}</span>
        </div>
        <div className="flex items-center gap-4 ml-auto text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>{i18n.t('options.config.sync.googleDrive.conflict.localValue')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>{i18n.t('options.config.sync.googleDrive.conflict.remoteValue')}</span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <JsonTreeView data={mergedConfig} />
      </div>
    </div>
  )
}
