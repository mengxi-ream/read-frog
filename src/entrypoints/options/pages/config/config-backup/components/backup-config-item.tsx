import type { ConfigBackup, ConfigBackupMetadata } from '@/types/backup'
import { i18n } from '#imports'
import { Icon } from '@iconify/react/dist/iconify.js'
import { useMutation } from '@tanstack/react-query'
import { useAtomValue, useSetAtom } from 'jotai'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/base-ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/shadcn/alert-dialog'
import { ButtonGroup } from '@/components/shadcn/button-group'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/shadcn/dropdown-menu'
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemTitle } from '@/components/shadcn/item'
import { Spinner } from '@/components/shadcn/spinner'
import { useExportConfig } from '@/hooks/use-export-config'
import { configAtom, writeConfigAtom } from '@/utils/atoms/config'
import { addBackup, isSameAsLatestBackup, removeBackup } from '@/utils/backup/storage'
import { migrateConfig } from '@/utils/config/migration'
import { EXTENSION_VERSION } from '@/utils/constants/app'
import { CONFIG_SCHEMA_VERSION } from '@/utils/constants/config'
import { queryClient } from '@/utils/tanstack-query'
import { ViewConfig } from '../../components/view-config'

interface BackupConfigItemProps {
  backupId: string
  backupMetadata: ConfigBackupMetadata
  backup: ConfigBackup
}

export function BackupConfigItem({ backupId, backupMetadata, backup }: BackupConfigItemProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <Item variant="muted">
      <ItemContent>
        <ItemTitle>{formatDate(backupMetadata.createdAt)}</ItemTitle>
        <ItemDescription className="text-xs flex flex-wrap items-center gap-x-4">
          <span>
            {i18n.t('options.config.backup.item.extensionVersion')}
            {' '}
            {backupMetadata.extensionVersion}
          </span>
          <span>
            {i18n.t('options.config.backup.item.schemaVersion')}
            {' '}
            {backup.schemaVersion}
          </span>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <ButtonGroup>
          <RestoreButton backup={backup} />
          <MoreOptions backupId={backupId} backup={backup} />
        </ButtonGroup>
      </ItemActions>
      <ItemFooter><ViewConfig config={backup.config} size="sm" /></ItemFooter>
    </Item>
  )
}

function RestoreButton({ backup }: { backup: ConfigBackup }) {
  const currentConfig = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)

  const { mutate: restoreBackup, isPending: isRestoring } = useMutation({
    mutationFn: async (backup: ConfigBackup) => {
      const migratedBackup = await migrateConfig(backup.config, backup.schemaVersion)

      const isSame = await isSameAsLatestBackup(currentConfig, CONFIG_SCHEMA_VERSION)

      if (!isSame) {
        await addBackup(currentConfig, EXTENSION_VERSION)
      }
      await setConfig(migratedBackup)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config-backups'] })
      toast.success(i18n.t('options.config.backup.restoreSuccess'))
    },
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isRestoring}>
          {isRestoring ? <Spinner /> : <Icon icon="tabler:restore" />}
          {i18n.t('options.config.backup.item.restore')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{i18n.t('options.config.backup.restore.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {i18n.t('options.config.backup.restore.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{i18n.t('options.config.backup.restore.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => restoreBackup(backup)} disabled={isRestoring}>
            {i18n.t('options.config.backup.restore.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function MoreOptions({ backupId, backup }: { backupId: string, backup: ConfigBackup }) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)

  const { mutate: deleteBackup, isPending: isDeleting } = useMutation({
    mutationFn: async (backupId: string) => {
      await removeBackup(backupId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config-backups'] })
    },
  })

  const { mutate: exportConfig, isPending: isExporting } = useExportConfig({
    config: backup.config,
    schemaVersion: backup.schemaVersion,
  })

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" disabled={isExporting || isDeleting}>
            <Icon icon="tabler:dots" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-40" align="end">
          <DropdownMenuItem onSelect={() => setShowExportDialog(true)} disabled={isExporting}>
            <Icon icon="tabler:file-export" />
            {i18n.t('options.config.backup.item.export')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShowDeleteDialog(true)}>
            <Icon icon="tabler:trash" />
            {i18n.t('options.config.backup.item.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n.t('options.config.backup.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>{i18n.t('options.config.backup.delete.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{i18n.t('options.config.backup.delete.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleteBackup(backupId)} disabled={isDeleting}>
              {i18n.t('options.config.backup.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n.t('options.config.sync.exportOptions.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {i18n.t('options.config.sync.exportOptions.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-between!">
            <AlertDialogCancel>{i18n.t('options.config.sync.exportOptions.cancel')}</AlertDialogCancel>
            <div className="flex gap-2">
              <AlertDialogAction variant="secondary" onClick={() => exportConfig(true)} disabled={isExporting}>
                {i18n.t('options.config.sync.exportOptions.includeAPIKeys')}
              </AlertDialogAction>
              <AlertDialogAction onClick={() => exportConfig(false)} disabled={isExporting}>
                {i18n.t('options.config.sync.exportOptions.excludeAPIKeys')}
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
