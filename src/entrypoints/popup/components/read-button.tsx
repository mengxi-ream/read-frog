import { browser, i18n } from '#imports'
import { useAtomValue } from 'jotai'

import { toast } from 'sonner'
import { Button } from '@/components/base-ui/button'
import { configFieldsAtomMap } from '@/utils/atoms/config'

import { isAnyAPIKeyForReadProviders } from '@/utils/config/api'
import { sendMessage } from '@/utils/message'
import { cn } from '@/utils/styles/utils'
import { isIgnoreTabAtom } from '../atoms/ignore'
import { isCurrentSiteInWhitelistAtom, isWhitelistModeAtom } from '../atoms/site-control'

export default function ReadButton({ className }: { className?: string }) {
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const isWhitelistMode = useAtomValue(isWhitelistModeAtom)
  const isCurrentSiteInWhitelist = useAtomValue(isCurrentSiteInWhitelistAtom)

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

  const isDisabled = isIgnoreTab || (isWhitelistMode && !isCurrentSiteInWhitelist)

  return (
    <Button
      onClick={requestReadArticle}
      variant="outline"
      className={cn('border-primary', className)}
      disabled={isDisabled}
    >
      {i18n.t('popup.read')}
    </Button>
  )
}
