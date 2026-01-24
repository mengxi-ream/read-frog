import { Icon } from '@iconify/react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Button } from '@/components/base-ui/button'
import { Textarea } from '@/components/base-ui/textarea'
import { inputTextAtom, sourceLanguageAtom, targetLanguageAtom, translateRequestAtom } from '../atoms'

export function TextInput() {
  const [value, setValue] = useAtom(inputTextAtom)
  const sourceLanguage = useAtomValue(sourceLanguageAtom)
  const targetLanguage = useAtomValue(targetLanguageAtom)
  const setTranslateRequest = useSetAtom(translateRequestAtom)

  const handleClear = () => {
    setValue('')
  }

  const handleTranslate = () => {
    if (!value.trim())
      return
    setTranslateRequest({
      inputText: value,
      sourceLanguage,
      targetLanguage,
      timestamp: Date.now(),
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleTranslate()
    }
  }

  return (
    <div
      className="relative"
    >
      <Textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter text to translate..."
        className="h-96 min-h-0 resize-none px-4 py-3"
        style={{ userSelect: 'text' }}
      />

      <Button
        onClick={handleTranslate}
        disabled={!value.trim()}
        size="sm"
        className="absolute bottom-3 right-3"
      >
        Translate
        <span className="ml-1.5 text-xs">⌘↵</span>
      </Button>
    </div>
  )
}
