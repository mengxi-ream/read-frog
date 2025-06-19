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
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { writeConfigAtom } from '@/utils/atoms/config'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import { ConfigCard } from '../../components/config-card'

export function ResetConfig() {
  const setConfig = useSetAtom(writeConfigAtom)
  function resetToDefaultConfig() {
    setConfig(DEFAULT_CONFIG)
  }

  return (
    <ConfigCard title={i18n.t('options.general.resetConfig.title')} description={i18n.t('options.general.resetConfig.description')}>
      <AlertDialog>
        <AlertDialogTrigger className="w-full flex items-center justify-end">
          <Button>{i18n.t('options.general.resetConfig.dialog.trigger')}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n.t('options.general.resetConfig.dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {i18n.t('options.general.resetConfig.dialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{i18n.t('options.general.resetConfig.dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={resetToDefaultConfig}>{i18n.t('options.general.resetConfig.dialog.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfigCard>
  )
}
