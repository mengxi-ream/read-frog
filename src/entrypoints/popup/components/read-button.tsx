import { browser, i18n } from '#imports'
import { useAtomValue } from 'jotai'

import { toast } from 'sonner'
import { Button } from '@/components/shadcn/button'
import { configFieldsAtomMap } from '@/utils/atoms/config'

import { isAnyAPIKeyForReadProviders } from '@/utils/config/api'
import { sendMessage } from '@/utils/message'
import { cn } from '@/utils/styles/tailwind'
import { isIgnoreTabAtom } from '../atoms/ignore'

export default function ReadButton({ className }: { className?: string }) {
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const requestReadArticle = async () => {
    if (!isAnyAPIKeyForReadProviders(providersConfig)) {
      toast.error(i18n.t('noAPIKeyConfig.warning'))
      return
    }
    const [currentTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })
    if (currentTab.id) {
      void sendMessage('popupRequestReadArticle', {
        tabId: currentTab.id,
      })
    }
  }

  return (
    <Button
      onClick={requestReadArticle}
      variant="outline"
      className={cn('border-primary', className)}
      disabled={isIgnoreTab}
    >
      {i18n.t('popup.read')}
    </Button>
  )
}
