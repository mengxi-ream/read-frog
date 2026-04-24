import type { SubtitlesFontFamily, SubtitleTextStyle } from "@/types/config/subtitles"
import { i18n } from "#imports"
import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { useEffect, useState } from "react"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/base-ui/select"
import { Slider } from "@/components/ui/base-ui/slider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { MAX_FONT_SCALE, MAX_FONT_WEIGHT, MIN_FONT_SCALE, MIN_FONT_WEIGHT } from "@/utils/constants/subtitles"

const FIELD_ROW_CLASS_NAME = "gap-0"
const FIELD_ROW_CONTENT_CLASS_NAME = "flex flex-col gap-2 @xs/field-group:grid @xs/field-group:grid-cols-[8.5rem_minmax(0,1fr)] @xs/field-group:items-center @xs/field-group:gap-x-4"
const FIELD_LABEL_CLASS_NAME = "text-sm whitespace-nowrap @xs/field-group:min-w-0"

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
  const [draftFontScale, setDraftFontScale] = useState(textStyle.fontScale)
  const [draftFontWeight, setDraftFontWeight] = useState(textStyle.fontWeight)

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setDraftFontScale(textStyle.fontScale)
  }, [textStyle.fontScale])

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setDraftFontWeight(textStyle.fontWeight)
  }, [textStyle.fontWeight])

  const handleChange = (style: Partial<SubtitleTextStyle>) => {
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, { style: { [type]: style } }))
  }

  return (
    <FieldGroup>
      <Field className={FIELD_ROW_CLASS_NAME}>
        <div className={FIELD_ROW_CONTENT_CLASS_NAME}>
          <FieldLabel className={FIELD_LABEL_CLASS_NAME}>{i18n.t("options.videoSubtitles.style.fontFamily")}</FieldLabel>
          <div className="min-w-0 @xs/field-group:min-w-0">
            <Select
              value={textStyle.fontFamily}
              onValueChange={(value) => {
                if (value)
                  handleChange({ fontFamily: value })
              }}
            >
              <SelectTrigger className="h-8 w-full">
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
          </div>
        </div>
      </Field>

      <Field className={FIELD_ROW_CLASS_NAME}>
        <div className={FIELD_ROW_CONTENT_CLASS_NAME}>
          <FieldLabel className={FIELD_LABEL_CLASS_NAME}>{i18n.t("options.videoSubtitles.style.fontScale")}</FieldLabel>
          <div className="flex min-w-0 items-center gap-2">
            <Slider
              min={MIN_FONT_SCALE}
              max={MAX_FONT_SCALE}
              step={10}
              value={draftFontScale}
              onValueChange={value => setDraftFontScale(value as number)}
              onValueCommitted={value => handleChange({ fontScale: value as number })}
              className="flex-1"
            />
            <span className="w-10 text-sm text-right">
              {draftFontScale}
              %
            </span>
          </div>
        </div>
      </Field>

      <Field className={FIELD_ROW_CLASS_NAME}>
        <div className={FIELD_ROW_CONTENT_CLASS_NAME}>
          <FieldLabel className={FIELD_LABEL_CLASS_NAME}>{i18n.t("options.videoSubtitles.style.fontWeight")}</FieldLabel>
          <div className="flex min-w-0 items-center gap-2">
            <Slider
              min={MIN_FONT_WEIGHT}
              max={MAX_FONT_WEIGHT}
              step={100}
              value={draftFontWeight}
              onValueChange={value => setDraftFontWeight(value as number)}
              onValueCommitted={value => handleChange({ fontWeight: value as number })}
              className="flex-1"
            />
            <span className="w-10 text-sm text-right">{draftFontWeight}</span>
          </div>
        </div>
      </Field>

      <Field className={FIELD_ROW_CLASS_NAME}>
        <div className={FIELD_ROW_CONTENT_CLASS_NAME}>
          <FieldLabel className={FIELD_LABEL_CLASS_NAME}>{i18n.t("options.videoSubtitles.style.color")}</FieldLabel>
          <div className="flex min-w-0 @xs/field-group:justify-end">
            <input
              type="color"
              value={textStyle.color}
              onChange={e => handleChange({ color: e.target.value })}
              className="!w-8 h-8 p-0.5 rounded border border-input cursor-pointer"
            />
          </div>
        </div>
      </Field>
    </FieldGroup>
  )
}
