import type { SubtitlesFontFamily, SubtitleTextStyle } from "@/types/config/subtitles"
import { i18n } from "#imports"
import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/base-ui/select"
import { Slider } from "@/components/ui/base-ui/slider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { MAX_FONT_SCALE, MAX_FONT_WEIGHT, MIN_FONT_SCALE, MIN_FONT_WEIGHT } from "@/utils/constants/subtitles"

const FONT_FAMILY_OPTIONS: { value: SubtitlesFontFamily, label: string }[] = [
  { value: "system", label: "System Default" },
  { value: "roboto", label: "Roboto" },
  { value: "noto-sans", label: "Noto Sans" },
  { value: "noto-serif", label: "Noto Serif" },
]

interface SubtitlesTextStyleFormProps {
  type: "main" | "translation"
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
        <FieldLabel className="text-sm whitespace-nowrap">{i18n.t("options.videoSubtitles.style.fontFamily")}</FieldLabel>
        <Select
          value={textStyle.fontFamily}
          onValueChange={(value) => {
            if (value)
              handleChange({ fontFamily: value })
          }}
        >
          <SelectTrigger className="h-8">
            <SelectValue>
              {FONT_FAMILY_OPTIONS.find(o => o.value === textStyle.fontFamily)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {FONT_FAMILY_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <Field orientation="responsive-compact">
        <FieldLabel className="text-sm whitespace-nowrap">{i18n.t("options.videoSubtitles.style.fontScale")}</FieldLabel>
        <div className="flex flex-1 min-w-0 items-center gap-2">
          <Slider
            min={MIN_FONT_SCALE}
            max={MAX_FONT_SCALE}
            step={10}
            value={textStyle.fontScale}
            onValueChange={value => handleChange({ fontScale: value as number })}
            className="flex-1"
          />
          <span className="w-10 text-sm text-right">
            {textStyle.fontScale}
            %
          </span>
        </div>
      </Field>

      <Field orientation="responsive-compact">
        <FieldLabel className="text-sm whitespace-nowrap">{i18n.t("options.videoSubtitles.style.fontWeight")}</FieldLabel>
        <div className="flex flex-1 min-w-0 items-center gap-2">
          <Slider
            min={MIN_FONT_WEIGHT}
            max={MAX_FONT_WEIGHT}
            step={100}
            value={textStyle.fontWeight}
            onValueChange={value => handleChange({ fontWeight: value as number })}
            className="flex-1"
          />
          <span className="w-10 text-sm text-right">{textStyle.fontWeight}</span>
        </div>
      </Field>

      <Field orientation="responsive-compact">
        <FieldLabel className="text-sm whitespace-nowrap">{i18n.t("options.videoSubtitles.style.color")}</FieldLabel>
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
