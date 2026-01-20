import { i18n } from '#imports'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
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
import { Button } from '@/components/shadcn/button'
import { sendMessage } from '@/utils/message'
import { ConfigCard } from '../../components/config-card'

export function ClearAiSegmentationCache() {
  const [isClearing, setIsClearing] = useState(false)

  async function handleClearCache() {
    try {
      setIsClearing(true)
      await sendMessage('clearAiSegmentationCache')
    }
    catch (error) {
      console.error('Failed to clear AI segmentation cache:', error)
    }
    finally {
      setIsClearing(false)
    }
  }

  return (
    <ConfigCard
      title={i18n.t('options.videoSubtitles.aiSegmentation.clearCacheDialog.title')}
      description={i18n.t('options.videoSubtitles.aiSegmentation.clearCacheDialog.description')}
    >
      <AlertDialog>
        <div className="w-full flex justify-end">
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={isClearing}>
              <IconTrash className="size-4" />
              {isClearing ? i18n.t('options.videoSubtitles.aiSegmentation.clearing') : i18n.t('options.videoSubtitles.aiSegmentation.clearCache')}
            </Button>
          </AlertDialogTrigger>
        </div>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n.t('options.videoSubtitles.aiSegmentation.clearCacheDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {i18n.t('options.videoSubtitles.aiSegmentation.clearCacheDialog.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{i18n.t('options.videoSubtitles.aiSegmentation.clearCacheDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleClearCache} disabled={isClearing}>
              {isClearing ? i18n.t('options.videoSubtitles.aiSegmentation.clearing') : i18n.t('options.videoSubtitles.aiSegmentation.clearCacheDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfigCard>
  )
}
