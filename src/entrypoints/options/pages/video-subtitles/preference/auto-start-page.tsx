import type { SubtitlesPlatform } from "@/types/config/subtitles"
import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { subtitlesPlatformSchema } from "@/types/config/subtitles"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../components/config-detail-section"
import { ConfigItem } from "../../../components/config-item"
import { PageLayout } from "../../../components/page-layout"
import { SubtitlesPlatformIcon } from "./platform-icon"

// Brand names, so they stay the same in every UI language.
const PLATFORM_NAMES = {
  youtube: "YouTube",
  xcom: "X",
  netflix: "Netflix",
} as const satisfies Record<SubtitlesPlatform, string>

/**
 * Drilled into from the Video Subtitles page: a translate-on-open switch per platform, so
 * subtitles can start on their own on one site and wait for the button on another.
 */
export function SubtitlesAutoStartPage() {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(
    configFieldsAtomMap.videoSubtitles,
  )

  const setPlatformAutoStart = (platform: SubtitlesPlatform, enabled: boolean) => {
    void setVideoSubtitlesConfig((current) => ({
      autoStart: { ...current.autoStart, [platform]: enabled },
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
          <span id="subtitles-auto-start">
            {i18n.t("options.videoSubtitles.preference.autoStart.title")}
          </span>
        }
      >
        {subtitlesPlatformSchema.options.map((platform) => {
          const name = PLATFORM_NAMES[platform]
          return (
            <ConfigItem
              key={platform}
              id={`subtitles-auto-start-${platform}`}
              title={
                <span className="flex items-center gap-2">
                  <SubtitlesPlatformIcon platform={platform} className="size-4 shrink-0" />
                  {name}
                </span>
              }
            >
              <Switch
                checked={videoSubtitlesConfig.autoStart[platform]}
                onCheckedChange={(enabled) => setPlatformAutoStart(platform, enabled)}
                aria-label={name}
              />
            </ConfigItem>
          )
        })}
      </ConfigDetailSection>
    </PageLayout>
  )
}
