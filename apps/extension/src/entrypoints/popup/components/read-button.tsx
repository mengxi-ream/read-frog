import { useAtomValue } from 'jotai'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { configFields } from '@/utils/atoms/config'
import { isAnyAPIKey } from '@/utils/config/config'

import { isIgnoreTabAtom } from '../atom'

export default function ReadButton({ className }: { className?: string }) {
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)
  const providersConfig = useAtomValue(configFields.providersConfig)

  const requestReadArticle = async () => {
    if (!isAnyAPIKey(providersConfig)) {
      toast.error(i18n.t('noConfig.warning'))
      return
    }
    const [currentTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (currentTab.id) {
      sendMessage('popupRequestReadArticle', {
        tabId: currentTab.id,
      })
    }
  }

  return (
    <Button
      onClick={requestReadArticle}
      className={cn('border-primary', className)}
      disabled={isIgnoreTab}
    >
      {i18n.t('popup.read')}
    </Button>
  )
}
