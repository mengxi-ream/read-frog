import type { SubtitlesPlatform, SubtitlesPlatformMode } from "@/types/config/subtitles"
import { useAtom } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { subtitlesPlatformModeSchema, subtitlesPlatformSchema } from "@/types/config/subtitles"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SUBTITLES_PLATFORM_NAMES } from "@/utils/constants/subtitles"
import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../components/config-detail-section"
import { ConfigItem } from "../../../components/config-item"
import { PageLayout } from "../../../components/page-layout"
import { SELECT_CONTENT_PROPS } from "../../../components/select-content-props"
import { SubtitlesPlatformIcon } from "./platform-icon"

/**
 * Drilled into from the Video Subtitles page: per platform, whether subtitles are off (no button
 * in the player), started from the button, or started as each video loads.
 */
export function SubtitlesSitesPage() {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(
    configFieldsAtomMap.videoSubtitles,
  )

  // Resolved at render (not module scope) so labels follow a runtime UI-language switch.
  const modes = subtitlesPlatformModeSchema.options.map((mode) => ({
    value: mode,
    label: i18n.t(`options.videoSubtitles.preference.enable.mode.${mode}`),
  })) satisfies Array<{ value: SubtitlesPlatformMode; label: string }>

  const setPlatformMode = (platform: SubtitlesPlatform, mode: SubtitlesPlatformMode) => {
    void setVideoSubtitlesConfig((current) => ({
      platforms: { ...current.platforms, [platform]: mode },
    }))
  }

  return (
    <PageLayout
      title={i18n.t("options.videoSubtitles.title")}
      description={i18n.t("options.videoSubtitles.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/video-subtitles"
        title={
          <span id="subtitles-sites">
            {i18n.t("options.videoSubtitles.preference.enable.title")}
          </span>
        }
      >
        {subtitlesPlatformSchema.options.map((platform) => {
          const name = SUBTITLES_PLATFORM_NAMES[platform]
          return (
            <ConfigItem
              key={platform}
              id={`subtitles-site-${platform}`}
              title={
                <span className="flex items-center gap-2">
                  <SubtitlesPlatformIcon platform={platform} className="size-4 shrink-0" />
                  {name}
                </span>
              }
            >
              <Select
                items={modes}
                value={videoSubtitlesConfig.platforms[platform]}
                onValueChange={(value) => {
                  const parsed = subtitlesPlatformModeSchema.safeParse(value)
                  if (parsed.success) setPlatformMode(platform, parsed.data)
                }}
              >
                <SelectTrigger size="sm" aria-label={name}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent {...SELECT_CONTENT_PROPS}>
                  <SelectGroup>
                    {modes.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </ConfigItem>
          )
        })}
      </ConfigDetailSection>
    </PageLayout>
  )
}
