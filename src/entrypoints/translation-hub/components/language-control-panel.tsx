import { Icon } from '@iconify/react'
import { useAtom, useSetAtom } from 'jotai'
import { Button } from '@/components/base-ui/button'
import { exchangeLanguagesAtom, sourceLanguageAtom, targetLanguageAtom } from '../atoms'
import { SearchableLanguageSelector } from './searchable-language-selector'

export function LanguageControlPanel() {
  const [sourceLanguage, setSourceLanguage] = useAtom(sourceLanguageAtom)
  const [targetLanguage, setTargetLanguage] = useAtom(targetLanguageAtom)
  const exchangeLanguages = useSetAtom(exchangeLanguagesAtom)

  return (
    <div className="flex items-center gap-3">
      <SearchableLanguageSelector
        value={sourceLanguage}
        onValueChange={setSourceLanguage}
        label="Source Language"
      />

      <div className="shrink-0 mt-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={exchangeLanguages}
          title="Exchange languages"
        >
          <Icon icon="tabler:arrows-exchange" className="h-4 w-4" />
        </Button>
      </div>

      <SearchableLanguageSelector
        value={targetLanguage}
        onValueChange={setTargetLanguage}
        label="Target Language"
      />
    </div>
  )
}
