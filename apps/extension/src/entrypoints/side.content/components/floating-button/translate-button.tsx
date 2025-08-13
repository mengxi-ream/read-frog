import type { TRANSLATE_PROVIDER_MODELS } from '@/types/config/provider'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { cn } from '@repo/ui/lib/utils'
import { useAtomValue } from 'jotai'
import { toast } from 'sonner'
import { PURE_TRANSLATE_PROVIDERS } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { hasSetAPIKey } from '@/utils/config/config'
import { removeAllTranslatedWrapperNodes } from '@/utils/host/translate/node-manipulation'
import { sendMessage } from '@/utils/message'
import { enablePageTranslationAtom } from '../../atoms'
import HiddenButton from './components/hidden-button'

export default function TranslateButton() {
  const enablePageTranslation = useAtomValue(enablePageTranslationAtom)
  const providersConfig = useAtomValue(configFields.providersConfig)
  const translateConfig = useAtomValue(configFields.translate)

  return (
    <HiddenButton
      icon="ri:translate"
      onClick={() => {
        const provider = translateConfig.provider
        const isPure = PURE_TRANSLATE_PROVIDERS.includes(
          provider as typeof PURE_TRANSLATE_PROVIDERS[number],
        )
        if (!isPure && !hasSetAPIKey(provider as keyof typeof TRANSLATE_PROVIDER_MODELS, providersConfig)) {
          toast.error(i18n.t('noConfig.warning'))
          return
        }
        if (!enablePageTranslation) {
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
      <Icon
        icon="tabler:check"
        className={cn(
          'absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-green-500 text-white',
          enablePageTranslation ? 'block' : 'hidden',
        )}
      />
    </HiddenButton>
  )
}
