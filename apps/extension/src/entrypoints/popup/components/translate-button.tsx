import type { translateProviderModels } from '@/types/config/provider'
import { useAtom, useAtomValue } from 'jotai'

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { pureTranslateProvider } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'

import { isPageTranslatedAtom } from '@/utils/atoms/translation'
import { hasSetAPIKey } from '@/utils/config/config'
import { isIgnoreTabAtom } from '../atom'

export default function TranslateButton({ className }: { className?: string }) {
  const [isPageTranslated, setIsPageTranslated] = useAtom(isPageTranslatedAtom)
  const isIgnoreTab = useAtomValue(isIgnoreTabAtom)
  const providersConfig = useAtomValue(configFields.providersConfig)
  const translateConfig = useAtomValue(configFields.translate)

  const toggleTranslation = async () => {
    const [currentTab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    })

    if (currentTab.id) {
      if (!isPageTranslated) {
        const provider = translateConfig.provider
        const isPure = pureTranslateProvider.includes(
          provider as typeof pureTranslateProvider[number],
        )

        if (!isPure && !hasSetAPIKey(provider as keyof typeof translateProviderModels, providersConfig)) {
          toast.error(i18n.t('noConfig.warning'))
          return
        }
      }

      sendMessage('setEnablePageTranslation', {
        tabId: currentTab.id,
        enabled: !isPageTranslated,
      })

      setIsPageTranslated(prev => !prev)
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
