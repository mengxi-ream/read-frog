import type { SubtitleTextStyle } from '@/types/config/subtitles'
import { useAtomValue } from 'jotai'
import { cn } from '@/lib/utils'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { SUBTITLE_FONT_FAMILIES } from '@/utils/constants/subtitles'
import { currentSubtitleAtom } from '../atoms'

interface SubtitleLineProps {
  content?: string
  className?: string
}

function getTextStyles(textStyle: SubtitleTextStyle) {
  const baseFontSize = 20

  return {
    fontFamily: SUBTITLE_FONT_FAMILIES[textStyle.fontFamily] || SUBTITLE_FONT_FAMILIES.system,
    fontSize: `${(textStyle.fontScale / 100) * baseFontSize}px`,
    color: textStyle.color,
    fontWeight: textStyle.fontWeight,
  }
}

export function MainSubtitle({ content, className }: SubtitleLineProps) {
  const subtitle = useAtomValue(currentSubtitleAtom)
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const text = content ?? subtitle?.text ?? ''

  return (
    <div
      className={cn('subtitles-main leading-tight text-xl', className)}
      style={getTextStyles(style.main)}
    >
      {text}
    </div>
  )
}

export function TranslationSubtitle({ content, className }: SubtitleLineProps) {
  const subtitle = useAtomValue(currentSubtitleAtom)
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const text = content ?? subtitle?.translation ?? ''

  return (
    <div
      className={cn('subtitles-translation leading-tight text-xl', className)}
      style={getTextStyles(style.translation)}
    >
      {text}
    </div>
  )
}
