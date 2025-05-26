import type { translateProviderModels } from '@/types/config/provider'
import { useAtomValue } from 'jotai'
import { Check, Languages } from 'lucide-react'

import { toast } from 'sonner'
import { pureTranslateProvider } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'

import { hasSetAPIKey } from '@/utils/config/config'
import { removeAllTranslatedWrapperNodes, translatePage } from '@/utils/host/translate'
import { enablePageTranslationAtom } from '../../atoms'
import HiddenButton from './components/hidden-button'

export default function TranslateButton() {
  const enablePageTranslation = useAtomValue(enablePageTranslationAtom)
  const providersConfig = useAtomValue(configFields.providersConfig)
  const translateConfig = useAtomValue(configFields.translate)

  return (
    <HiddenButton
      Icon={Languages}
      onClick={() => {
        const provider = translateConfig.provider
        const isPure = pureTranslateProvider.includes(
          provider as typeof pureTranslateProvider[number],
        )
        if (!isPure && !hasSetAPIKey(provider as keyof typeof translateProviderModels, providersConfig)) {
          toast.error(i18n.t('noConfig.warning'))
          return
        }
        if (!enablePageTranslation) {
          translatePage()
          sendMessage('setEnablePageTranslationOnContentScript', {
            enabled: true,
          })
        }
        else {
          removeAllTranslatedWrapperNodes()
          sendMessage('setEnablePageTranslationOnContentScript', {
            enabled: false,
          })
        }
      }}
    >
      <Check
        className={cn(
          'absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-green-500 text-white',
          enablePageTranslation ? 'block' : 'hidden',
        )}
      />
    </HiddenButton>
  )
}
