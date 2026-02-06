import { i18n } from '#imports'
import { IconRefresh } from '@tabler/icons-react'
import { useSetAtom } from 'jotai'
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
} from '@/components/ui/base-ui/alert-dialog'
import { Button } from '@/components/ui/base-ui/button'
import { writeConfigAtom } from '@/utils/atoms/config'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import { ConfigCard } from '../../components/config-card'

export function ResetConfig() {
  const setConfig = useSetAtom(writeConfigAtom)
  function resetToDefaultConfig() {
    void setConfig(DEFAULT_CONFIG)
  }

  return (
    <ConfigCard title={i18n.t('options.config.resetConfig.title')} description={i18n.t('options.config.resetConfig.description')}>
      <AlertDialog>
        <div className="w-full flex justify-end">
          <AlertDialogTrigger render={<Button variant="destructive" />}>
            <IconRefresh className="size-4" />
            {i18n.t('options.config.resetConfig.dialog.trigger')}
          </AlertDialogTrigger>
        </div>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n.t('options.config.resetConfig.dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {i18n.t('options.config.resetConfig.dialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{i18n.t('options.config.resetConfig.dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={resetToDefaultConfig}>
              {i18n.t('options.config.resetConfig.dialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfigCard>
  )
}
