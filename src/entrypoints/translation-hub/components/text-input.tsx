import { Icon } from '@iconify/react'
import { useAtom, useSetAtom } from 'jotai'
import { useEffect, useRef, useState } from 'react'
import { inputTextAtom, translationResultsAtom } from '../atoms'

interface TextInputProps {
  onTranslate: () => void
  placeholder?: string
  disabled?: boolean
}

export function TextInput({
  onTranslate,
  placeholder = 'Enter text to translate...',
  disabled = false,
}: TextInputProps) {
  const [value, setValue] = useAtom(inputTextAtom)
  const setTranslationResults = useSetAtom(translationResultsAtom)
  const [isFocused, setIsFocused] = useState(false)

  // Keep track of the latest callback without triggering effects
  const onTranslateRef = useRef(onTranslate)

  useEffect(() => {
    onTranslateRef.current = onTranslate
  }, [onTranslate])

  useEffect(() => {
    if (!value.trim())
      return

    const timer = setTimeout(() => {
      onTranslateRef.current()
    }, 1000)

    return () => clearTimeout(timer)
  }, [value]) // Only trigger when value changes

  const handleClear = () => {
    setValue('')
    setTranslationResults([])
  }

  const handleChange = (newValue: string) => {
    setValue(newValue)
    if (!newValue.trim()) {
      setTranslationResults([])
    }
  }

  return (
    <div className="relative bg-background rounded-xl self-start">
      <div className={`relative border rounded-xl ${isFocused ? 'ring-1 ring-primary/30 border-primary/50' : 'border-border hover:border-border/80'}`}>
        <textarea
          value={value}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full h-96 px-4 py-3 text-base bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground"
          style={{ userSelect: 'text' }}
        />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-3 right-3 z-20 p-1 text-muted-foreground hover:text-foreground transition-colors hover:bg-background/80 rounded"
            title="Clear text"
          >
            <Icon icon="tabler:x" className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
