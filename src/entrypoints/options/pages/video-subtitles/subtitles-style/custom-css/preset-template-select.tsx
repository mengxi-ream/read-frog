import type { SubtitleCssPresetId } from "@/utils/constants/subtitles"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { SUBTITLE_CSS_PRESET_IDS, SUBTITLE_CSS_PRESETS } from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"
import { SELECT_CONTENT_PROPS } from "../../../../components/select-content-props"

interface PresetTemplateSelectProps {
  /** Receives the preset's CSS, already carrying a comment naming it. */
  onApply: (css: string) => void
}

/**
 * Applies a preset into the editor and forgets it.
 *
 * Holding the chosen preset as config instead would let it drift: a preset is a starting point the
 * user is expected to edit, and a dropdown still reading "Blur translation" after the blur has been
 * rewritten into an outline names something that is no longer there. So the value stays empty and
 * the control reads as the action it is.
 */
export function PresetTemplateSelect({ onApply }: PresetTemplateSelectProps) {
  return (
    <Select
      value={null}
      onValueChange={(preset: SubtitleCssPresetId | null) => {
        if (!preset) return
        onApply(`/* ${presetLabel(preset)} */\n${SUBTITLE_CSS_PRESETS[preset]}`)
      }}
    >
      <SelectTrigger size="sm">
        <SelectValue render={<span />}>
          {i18n.t("options.videoSubtitles.style.customCSS.presetPlaceholder")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent {...SELECT_CONTENT_PROPS}>
        <SelectGroup>
          {SUBTITLE_CSS_PRESET_IDS.map((preset) => (
            <SelectItem key={preset} value={preset}>
              {presetLabel(preset)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

/** Localised at append time, so the comment left in the CSS is in the language it was added from. */
function presetLabel(preset: SubtitleCssPresetId): string {
  return i18n.t(`options.videoSubtitles.style.customCSS.presets.${preset}`)
}
