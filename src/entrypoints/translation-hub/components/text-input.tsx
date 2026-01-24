import { Icon } from '@iconify/react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useState } from 'react'
import { Button } from '@/components/base-ui/button'
import { inputTextAtom, sourceLanguageAtom, targetLanguageAtom, translateRequestAtom } from '../atoms'

export function TextInput() {
  const [value, setValue] = useAtom(inputTextAtom)
  const sourceLanguage = useAtomValue(sourceLanguageAtom)
  const targetLanguage = useAtomValue(targetLanguageAtom)
  const setTranslateRequest = useSetAtom(translateRequestAtom)
  const [isFocused, setIsFocused] = useState(false)

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
    <div className="relative bg-background rounded-xl self-start">
      <div className={`relative border rounded-xl ${isFocused ? 'ring-1 ring-primary/30 border-primary/50' : 'border-border hover:border-border/80'}`}>
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Enter text to translate..."
          className="w-full h-96 px-4 py-3 text-base bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground"
          style={{ userSelect: 'text' }}
        />

        <div className="absolute top-3 right-3 z-20 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors hover:bg-background/80 rounded"
              title="Clear text"
            >
              <Icon icon="tabler:x" className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="absolute bottom-3 right-3 z-20">
          <Button
            onClick={handleTranslate}
            disabled={!value.trim()}
            size="sm"
          >
            Translate
            <span className="ml-1.5 text-xs opacity-70">⌘↵</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
