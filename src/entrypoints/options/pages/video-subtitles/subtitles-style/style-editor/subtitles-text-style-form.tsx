import type { SubtitlesFontFamily, SubtitleTextStyle } from "@/types/config/subtitles"
import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { useEffect, useState } from "react"
import { DebouncedColorPicker } from "@/components/debounced-color-picker"
import { Field, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/base-ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { SliderComfortable } from "@/components/ui/base-ui/slider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  MAX_FONT_SCALE,
  MAX_FONT_WEIGHT,
  MIN_FONT_SCALE,
  MIN_FONT_WEIGHT,
} from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"

const FONT_FAMILY_OPTIONS: { value: SubtitlesFontFamily; label: string }[] = [
  { value: "system", label: "System Default" },
  { value: "roboto", label: "Roboto" },
  { value: "noto-sans", label: "Noto Sans" },
  { value: "noto-serif", label: "Noto Serif" },
]

interface SubtitlesTextStyleFormProps {
  type: "main" | "translation"
}

export function SubtitlesTextStyleForm({ type }: SubtitlesTextStyleFormProps) {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(
    configFieldsAtomMap.videoSubtitles,
  )
  const textStyle = videoSubtitlesConfig.style[type]
  const fontFamilyId = `video-subtitles-${type}-font-family`
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
    // Keyed explicitly rather than via a computed `[type]` key: a computed union
    // key widens the patch to an index signature, which poisons the merged type.
    const stylePatch = type === "main" ? { main: style } : { translation: style }
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, { style: stylePatch }))
  }

  return (
    <FieldGroup>
      <Field orientation="responsive">
        <FieldLabel htmlFor={fontFamilyId}>
          {i18n.t("options.videoSubtitles.style.fontFamily")}
        </FieldLabel>
        <Select
          value={textStyle.fontFamily}
          onValueChange={(value) => {
            if (value) handleChange({ fontFamily: value })
          }}
        >
          <SelectTrigger id={fontFamilyId}>
            <SelectValue>
              {FONT_FAMILY_OPTIONS.find((o) => o.value === textStyle.fontFamily)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {FONT_FAMILY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <Field orientation="responsive">
        <FieldTitle>{i18n.t("options.videoSubtitles.style.fontScale")}</FieldTitle>
        <SliderComfortable
          variant="scrubber"
          aria-label={i18n.t("options.videoSubtitles.style.fontScale")}
          min={MIN_FONT_SCALE}
          max={MAX_FONT_SCALE}
          step={10}
          value={draftFontScale}
          onChange={setDraftFontScale}
          onCommit={(value) => handleChange({ fontScale: value })}
          formatValue={(v) => `${v}%`}
        />
      </Field>

      <Field orientation="responsive">
        <FieldTitle>{i18n.t("options.videoSubtitles.style.fontWeight")}</FieldTitle>
        <SliderComfortable
          variant="scrubber"
          aria-label={i18n.t("options.videoSubtitles.style.fontWeight")}
          min={MIN_FONT_WEIGHT}
          max={MAX_FONT_WEIGHT}
          step={100}
          value={draftFontWeight}
          onChange={setDraftFontWeight}
          onCommit={(value) => handleChange({ fontWeight: value })}
        />
      </Field>

      <Field orientation="responsive">
        <FieldTitle>{i18n.t("options.videoSubtitles.style.color")}</FieldTitle>
        <DebouncedColorPicker
          value={textStyle.color}
          onCommit={(color) => handleChange({ color })}
          triggerClassName="h-8"
        />
      </Field>
    </FieldGroup>
  )
}
