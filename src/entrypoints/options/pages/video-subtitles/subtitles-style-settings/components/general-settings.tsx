import type { SubtitlesDisplayMode, SubtitlesTranslationPosition } from "@/types/config/subtitles"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { Button } from "@/components/ui/base-ui/button"
import { Card } from "@/components/ui/base-ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/base-ui/field"
import { Label } from "@/components/ui/base-ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/base-ui/select"
import { Slider } from "@/components/ui/base-ui/slider"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { DEFAULT_BACKGROUND_OPACITY, DEFAULT_DISPLAY_MODE, DEFAULT_TRANSLATION_POSITION, MAX_BACKGROUND_OPACITY, MIN_BACKGROUND_OPACITY } from "@/utils/constants/subtitles"

export function GeneralSettings() {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(configFieldsAtomMap.videoSubtitles)
  const { displayMode, translationPosition, container } = videoSubtitlesConfig.style

  const handleDisplayModeChange = (value: SubtitlesDisplayMode | null) => {
    if (!value)
      return
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, { style: { displayMode: value } }))
  }

  const handleTranslationPositionChange = (value: SubtitlesTranslationPosition | null) => {
    if (!value)
      return
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, { style: { translationPosition: value } }))
  }

  const handleContainerChange = (style: Partial<typeof container>) => {
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, { style: { container: style } }))
  }

  const resetGeneralConfig = () => {
    void setVideoSubtitlesConfig(deepmerge(videoSubtitlesConfig, {
      style: {
        displayMode: DEFAULT_DISPLAY_MODE,
        translationPosition: DEFAULT_TRANSLATION_POSITION,
        container: {
          backgroundOpacity: DEFAULT_BACKGROUND_OPACITY,
        },
      },
    }))
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon="tabler:settings" className="size-4" />
          <Label className="text-sm font-semibold">{i18n.t("options.videoSubtitles.style.generalSettings")}</Label>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={<Button variant="ghost" size="sm" className="-mr-2" onClick={resetGeneralConfig} />}
          >
            <Icon icon="tabler:refresh" />
          </TooltipTrigger>
          <TooltipContent>{i18n.t("options.videoSubtitles.style.reset")}</TooltipContent>
        </Tooltip>
      </div>

      <FieldGroup>
        <Field orientation="responsive-compact">
          <FieldLabel className="text-sm whitespace-nowrap">{i18n.t("options.videoSubtitles.style.displayMode.title")}</FieldLabel>
          <Select value={displayMode} onValueChange={handleDisplayModeChange}>
            <SelectTrigger className="h-8">
              <SelectValue>
                {i18n.t(`options.videoSubtitles.style.displayMode.${displayMode}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="bilingual">
                  {i18n.t("options.videoSubtitles.style.displayMode.bilingual")}
                </SelectItem>
                <SelectItem value="originalOnly">
                  {i18n.t("options.videoSubtitles.style.displayMode.originalOnly")}
                </SelectItem>
                <SelectItem value="translationOnly">
                  {i18n.t("options.videoSubtitles.style.displayMode.translationOnly")}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {displayMode === "bilingual" && (
          <Field orientation="responsive-compact">
            <FieldLabel className="text-sm whitespace-nowrap">{i18n.t("options.videoSubtitles.style.translationPosition.title")}</FieldLabel>
            <Select value={translationPosition} onValueChange={handleTranslationPositionChange}>
              <SelectTrigger className="h-8">
                <SelectValue>
                  {i18n.t(`options.videoSubtitles.style.translationPosition.${translationPosition}`)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="above">
                    {i18n.t("options.videoSubtitles.style.translationPosition.above")}
                  </SelectItem>
                  <SelectItem value="below">
                    {i18n.t("options.videoSubtitles.style.translationPosition.below")}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field orientation="responsive-compact">
          <FieldLabel className="text-sm whitespace-nowrap">{i18n.t("options.videoSubtitles.style.backgroundOpacity")}</FieldLabel>
          <div className="flex flex-1 min-w-0 items-center gap-2">
            <Slider
              min={MIN_BACKGROUND_OPACITY}
              max={MAX_BACKGROUND_OPACITY}
              step={5}
              value={container.backgroundOpacity}
              onValueChange={value => handleContainerChange({ backgroundOpacity: value as number })}
              className="flex-1"
            />
            <span className="w-10 text-sm text-right">
              {container.backgroundOpacity}
              %
            </span>
          </div>
        </Field>
      </FieldGroup>
    </Card>
  )
}
