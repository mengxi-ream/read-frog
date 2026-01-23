import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useMutation } from '@tanstack/react-query'
import { useAtomValue, useSetAtom } from 'jotai'
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
import { Input } from '@/components/shadcn/input'
import { Label } from '@/components/shadcn/label'
import { useExportConfig } from '@/hooks/use-export-config'
import { configAtom, writeConfigAtom } from '@/utils/atoms/config'
import { addBackup } from '@/utils/backup/storage'
import { migrateConfig } from '@/utils/config/migration'
import { EXTENSION_VERSION } from '@/utils/constants/app'
import { CONFIG_SCHEMA_VERSION } from '@/utils/constants/config'
import { queryClient } from '@/utils/tanstack-query'
import { ConfigCard } from '../../components/config-card'
import { ViewConfig } from './components/view-config'

export function ManualConfigSync() {
  const config = useAtomValue(configAtom)
  return (
    <ConfigCard
      title={i18n.t('options.config.sync.title')}
      description={i18n.t('options.config.sync.description')}
    >
      <div className="w-full space-y-4">
        <div className="text-end gap-3 flex justify-end">
          <ImportConfig />
          <ExportConfig />
        </div>
        <ViewConfig config={config} />
      </div>
    </ConfigCard>
  )
}

function ImportConfig() {
  const currentConfig = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)

  const { mutate: importConfig, isPending: isImporting } = useMutation({
    mutationFn: async (file: File) => {
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (event) => {
          const result = event.target?.result
          if (typeof result === 'string') {
            resolve(result)
          }
          else {
            reject(new Error('Invalid file content'))
          }
        }
        reader.onerror = () => reject(new Error(i18n.t('options.config.sync.importError')))
        reader.readAsText(file)
      })

      const parsed = JSON.parse(fileContent)
      // TODO: Remove __configSchemaVersion fallback after all users have migrated to v38+
      const importConfigSchemaVersion = parsed.schemaVersion ?? parsed.__configSchemaVersion
      const importConfigData = parsed.config

      const newConfig = await migrateConfig(importConfigData, importConfigSchemaVersion)
      await addBackup(currentConfig, EXTENSION_VERSION)
      await setConfig(newConfig)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config-backups'] })
      toast.success(i18n.t('options.config.sync.importSuccess'))
    },
  })

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      importConfig(file)
    }
    e.target.value = ''
    e.target.files = null
  }

  return (
    <Button variant="outline" className="p-0" disabled={isImporting}>
      <Label htmlFor="import-config-file" className="w-full px-3">
        <Icon icon="tabler:file-import" className="size-4" />
        {i18n.t('options.config.sync.import')}
      </Label>
      <Input
        type="file"
        id="import-config-file"
        className="hidden"
        accept=".json"
        onChange={handleImportConfig}
      />
    </Button>
  )
}

function ExportConfig() {
  const config = useAtomValue(configAtom)

  const { mutate: exportConfig, isPending: isExporting } = useExportConfig({
    config,
    schemaVersion: CONFIG_SCHEMA_VERSION,
    onSuccess: () => {
      toast.success(i18n.t('options.config.sync.exportSuccess'))
    },
  })

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={isExporting}>
          <Icon icon="tabler:file-export" className="size-4" />
          {i18n.t('options.config.sync.export')}
        </Button>
      </AlertDialogTrigger>

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
  )
}
