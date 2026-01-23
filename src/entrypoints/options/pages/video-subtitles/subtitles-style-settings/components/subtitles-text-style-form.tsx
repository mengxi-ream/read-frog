import type { SubtitlesFontFamily, SubtitleTextStyle } from '@/types/config/subtitles'
import { i18n } from '#imports'
import { deepmerge } from 'deepmerge-ts'
import { useAtom } from 'jotai'
import { Field, FieldGroup, FieldLabel } from '@/components/shadcn/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/shadcn/select'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { MAX_FONT_SCALE, MAX_FONT_WEIGHT, MIN_FONT_SCALE, MIN_FONT_WEIGHT } from '@/utils/constants/subtitles'

const FONT_FAMILY_OPTIONS: { value: SubtitlesFontFamily, label: string }[] = [
  { value: 'system', label: 'System Default' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'noto-sans', label: 'Noto Sans' },
  { value: 'noto-serif', label: 'Noto Serif' },
]

interface SubtitlesTextStyleFormProps {
  type: 'main' | 'translation'
}

export function SubtitlesTextStyleForm({ type }: SubtitlesTextStyleFormProps) {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(configFieldsAtomMap.videoSubtitles)
  const textStyle = videoSubtitlesConfig.style[type]

  const handleChange = (style: Partial<SubtitleTextStyle>) => {
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, { style: { [type]: style } }))
  }

  return (
    <FieldGroup>
      <Field orientation="responsive-compact">
        <FieldLabel className="text-sm whitespace-nowrap">{i18n.t('options.videoSubtitles.style.fontFamily')}</FieldLabel>
        <Select
          value={textStyle.fontFamily}
          onValueChange={(value: SubtitlesFontFamily) => handleChange({ fontFamily: value })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_FAMILY_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field orientation="responsive-compact">
        <FieldLabel className="text-sm whitespace-nowrap">{i18n.t('options.videoSubtitles.style.fontScale')}</FieldLabel>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={MIN_FONT_SCALE}
            max={MAX_FONT_SCALE}
            step={10}
            value={textStyle.fontScale}
            onChange={e => handleChange({ fontScale: Number(e.target.value) })}
            className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <span className="w-10 text-sm text-right">
            {textStyle.fontScale}
            %
          </span>
        </div>
      </Field>

      <Field orientation="responsive-compact">
        <FieldLabel className="text-sm whitespace-nowrap">{i18n.t('options.videoSubtitles.style.fontWeight')}</FieldLabel>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={MIN_FONT_WEIGHT}
            max={MAX_FONT_WEIGHT}
            step={100}
            value={textStyle.fontWeight}
            onChange={e => handleChange({ fontWeight: Number(e.target.value) })}
            className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <span className="w-10 text-sm text-right">{textStyle.fontWeight}</span>
        </div>
      </Field>

      <Field orientation="responsive-compact">
        <FieldLabel className="text-sm whitespace-nowrap">{i18n.t('options.videoSubtitles.style.color')}</FieldLabel>
        <input
          type="color"
          value={textStyle.color}
          onChange={e => handleChange({ color: e.target.value })}
          className="!w-8 h-8 p-0.5 rounded border border-input cursor-pointer"
        />
      </Field>
    </FieldGroup>
  )
}
