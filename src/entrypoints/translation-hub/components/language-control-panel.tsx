import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import debounce from 'debounce'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useMemo } from 'react'
import { Button } from '@/components/base-ui/button'
import { isLLMTranslateProviderConfig } from '@/types/config/provider'
import { translateProviderConfigAtom } from '@/utils/atoms/provider'
import { detectLanguage } from '@/utils/content/language'
import { detectedSourceLangCodeAtom, exchangeLangCodesAtom, inputTextAtom, sourceLangCodeAtom, targetLangCodeAtom } from '../atoms'
import { SearchableLanguageSelector } from './searchable-language-selector'

export function LanguageControlPanel() {
  const [sourceLangCode, setSourceLangCode] = useAtom(sourceLangCodeAtom)
  const [targetLangCode, setTargetLangCode] = useAtom(targetLangCodeAtom)
  const exchangeLangCodes = useSetAtom(exchangeLangCodesAtom)
  const inputText = useAtomValue(inputTextAtom)
  const [detectedSourceLangCode, setDetectedSourceLangCode] = useAtom(detectedSourceLangCodeAtom)
  const translateProviderConfig = useAtomValue(translateProviderConfigAtom)

  // Debounced language detection from input text
  const isLLMProvider = isLLMTranslateProviderConfig(translateProviderConfig)
  const debouncedDetect = useMemo(
    () => debounce(async (text: string) => {
      const detected = await detectLanguage(text, {
        minLength: 1,
        enableLLM: isLLMProvider,
        providerConfig: isLLMProvider ? translateProviderConfig : undefined,
      })
      setDetectedSourceLangCode(detected)
    }, 1000),
    [setDetectedSourceLangCode, translateProviderConfig, isLLMProvider],
  )

  useEffect(() => {
    void debouncedDetect(inputText)
    return () => debouncedDetect.clear()
  }, [inputText, debouncedDetect])

  const detectedLangCode = detectedSourceLangCode ?? 'eng'

  return (
    <div className="flex items-center gap-3 w-full">
      <SearchableLanguageSelector
        className="flex-1 min-w-0"
        value={sourceLangCode}
        onValueChange={setSourceLangCode}
        detectedLangCode={detectedLangCode}
        label={i18n.t('side.sourceLang')}
      />

      <div className="shrink-0 self-end pb-0.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={exchangeLangCodes}
          disabled={sourceLangCode === 'auto'}
          title={i18n.t('translationHub.exchangeLanguages')}
        >
          <Icon icon="tabler:arrows-exchange" className="h-4 w-4" />
        </Button>
      </div>

      <SearchableLanguageSelector
        className="flex-1 min-w-0"
        value={targetLangCode}
        onValueChange={(value) => {
          if (value !== 'auto')
            setTargetLangCode(value)
        }}
        label={i18n.t('side.targetLang')}
      />
    </div>
  )
}
