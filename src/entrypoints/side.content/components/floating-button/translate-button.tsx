import type { translateProviderModels } from '@/types/config/provider'
import { useAtom, useAtomValue } from 'jotai'
import { Check, Languages } from 'lucide-react'

import { toast } from 'sonner'
import { pureTranslateProvider } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { isPageTranslatedAtom } from '@/utils/atoms/translation'

import { hasSetAPIKey } from '@/utils/config/config'
import { removeAllTranslatedWrapperNodes, translatePage } from '@/utils/host/translate'
import HiddenButton from './components/hidden-button'

export default function TranslateButton() {
  const [isPageTranslated, setIsPageTranslated] = useAtom(isPageTranslatedAtom)
  const providersConfig = useAtomValue(configFields.providersConfig)
  const translateConfig = useAtomValue(configFields.translate)

  useEffect(() => {
    const removeListener = onMessage(
      'setIsPageTranslatedOnSideContent',
      async (message) => {
        if (message.data.isPageTranslated) {
          translatePage()
          setIsPageTranslated(true)
        }
        else {
          removeAllTranslatedWrapperNodes()
          setIsPageTranslated(false)
        }
      },
    )

    return () => {
      removeListener()
    }
  }, [setIsPageTranslated])

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
        if (!isPageTranslated) {
          translatePage()
          setIsPageTranslated(true)
          sendMessage('uploadIsPageTranslated', {
            isPageTranslated: true,
          })
        }
        else {
          removeAllTranslatedWrapperNodes()
          setIsPageTranslated(false)
          sendMessage('uploadIsPageTranslated', {
            isPageTranslated: false,
          })
        }
      }}
    >
      <Check
        className={cn(
          'absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-green-500 text-white',
          isPageTranslated ? 'block' : 'hidden',
        )}
      />
    </HiddenButton>
  )
}
