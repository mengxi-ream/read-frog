import { useAtom, useAtomValue } from 'jotai'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { configFields } from '@/utils/atoms/config'
import { isPageTranslatedAtom } from '@/utils/atoms/translation'
import { isAnyAPIKey } from '@/utils/config/config'

import { isIgnoreTabAtom } from '../atom'

export default function TranslateButton({ className }: { className?: string }) {
  const [isPageTranslated, setIsPageTranslated] = useAtom(isPageTranslatedAtom)
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)
  const providersConfig = useAtomValue(configFields.providersConfig)

  const toggleTranslation = async () => {
    const [currentTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })

    if (currentTab.id) {
      if (!isPageTranslated) {
        if (!isAnyAPIKey(providersConfig)) {
          toast.error(i18n.t('noConfig.warning'))
          return
        }
      }
      setIsPageTranslated(prev => !prev)
      sendMessage('updateIsPageTranslated', {
        tabId: currentTab.id,
        isPageTranslated: !isPageTranslated,
      })
    }
  }

  return (
    <Button
      onClick={toggleTranslation}
      disabled={isIgnoreTab}
      variant="outline"
      className={cn('border-primary', className)}
    >
      {isPageTranslated
        ? i18n.t('popup.showOriginal')
        : i18n.t('popup.translate')}
    </Button>
  )
}
