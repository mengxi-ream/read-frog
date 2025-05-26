'use client'

import { useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
  const { t } = useTranslation()
  const setConfig = useSetAtom(writeConfigAtom)

  function resetToDefaultConfig() {
    setConfig(DEFAULT_CONFIG)
    toast.success(t('resetConfig.toastSuccess'))
  }

  return (
    <ConfigCard
      title={t('resetConfig.cardTitle')}
      description={t('resetConfig.cardDescription')}
      className="!border-red-100"
    >
      <div className="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">{t('resetConfig.button')}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('resetConfig.confirmTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('resetConfig.confirmDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('resetConfig.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={resetToDefaultConfig}>
                {t('resetConfig.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ConfigCard>
  )
}
