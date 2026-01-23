import { i18n } from '#imports'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
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
import { sendMessage } from '@/utils/message'
import { ConfigCard } from '../../components/config-card'

export function ClearCacheConfig() {
  const [isClearing, setIsClearing] = useState(false)

  async function handleClearCache() {
    try {
      setIsClearing(true)
      await sendMessage('clearAllTranslationRelatedCache')
      // Show success message or notification here if needed
    }
    catch (error) {
      console.error('Failed to clear cache:', error)
      // Show error message or notification here if needed
    }
    finally {
      setIsClearing(false)
    }
  }

  return (
    <ConfigCard title={i18n.t('options.general.clearCache.title')} description={i18n.t('options.general.clearCache.description')}>
      <AlertDialog>
        <div className="w-full flex justify-end">
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isClearing}>
              <IconTrash className="size-4" />
              {isClearing ? i18n.t('options.general.clearCache.clearing') : i18n.t('options.general.clearCache.dialog.trigger')}
            </Button>
          </AlertDialogTrigger>
        </div>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n.t('options.general.clearCache.dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {i18n.t('options.general.clearCache.dialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{i18n.t('options.general.clearCache.dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleClearCache} disabled={isClearing}>
              {isClearing ? i18n.t('options.general.clearCache.clearing') : i18n.t('options.general.clearCache.dialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfigCard>
  )
}
