import { useAtomValue } from 'jotai'
import { cn } from '@/lib/utils'
import { currentSubtitleAtom } from '../atoms'

interface SubtitleLineProps {
  content?: string
  className?: string
}

export function MainSubtitle({ content, className }: SubtitleLineProps) {
  const subtitle = useAtomValue(currentSubtitleAtom)
  const text = content ?? subtitle?.text ?? ''

  return (
    <div className={cn('subtitles-main leading-tight text-xl', className)}>
      {text}
    </div>
  )
}

export function TranslationSubtitle({ content, className }: SubtitleLineProps) {
  const subtitle = useAtomValue(currentSubtitleAtom)
  const text = content ?? subtitle?.translation ?? ''

  return (
    <div className={cn('subtitles-translation leading-tight text-xl', className)}>
      {text}
    </div>
  )
}
