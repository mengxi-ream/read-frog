import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { subtitlesPlatformSchema } from "@/types/config/subtitles"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { ConfigItem } from "../../../components/config-item"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { ConfigSection } from "../../../components/config-section"
import { SubtitlesPlatformIcon } from "./platform-icon"
import { WordLookupActionItem } from "./word-lookup-action-item"

/**
 * Where subtitles get translated and how they start, and whether AI re-cuts the lines first —
 * the settings every other section on the page only matters under. Each platform is off, started
 * from the button, or started as a video loads, on the page the first row opens; the logos on
 * that row name the platforms, a greyed one being off.
 */
export function PreferenceSection() {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(
    configFieldsAtomMap.videoSubtitles,
  )

  return (
    <ConfigSection title={i18n.t("options.videoSubtitles.preference.title")}>
      <ConfigNavItem
        to="/video-subtitles/sites"
        title={
          <span className="flex items-center gap-2">
            {i18n.t("options.videoSubtitles.preference.enable.title")}
            <span className="flex items-center gap-1.5">
              {subtitlesPlatformSchema.options.map((platform) => (
                <SubtitlesPlatformIcon
                  key={platform}
                  platform={platform}
                  className={cn(
                    "size-3.5",
                    videoSubtitlesConfig.platforms[platform] === "off" && "opacity-30 grayscale",
                  )}
                />
              ))}
            </span>
          </span>
        }
        description={i18n.t("options.videoSubtitles.preference.enable.description")}
      />
      <ConfigItem
        id="subtitles-ai-segmentation"
        title={i18n.t("options.videoSubtitles.preference.aiSegmentation.title")}
        description={i18n.t("options.videoSubtitles.preference.aiSegmentation.description")}
      >
        <Switch
          checked={videoSubtitlesConfig.aiSegmentation}
          onCheckedChange={(aiSegmentation) => {
            void setVideoSubtitlesConfig({ aiSegmentation })
          }}
        />
      </ConfigItem>
      <WordLookupActionItem />
      <ConfigItem
        id="subtitles-pause-on-hover"
        title={i18n.t("options.videoSubtitles.preference.pauseOnHover.title")}
        description={i18n.t("options.videoSubtitles.preference.pauseOnHover.description")}
      >
        <Switch
          checked={videoSubtitlesConfig.pauseOnHover}
          onCheckedChange={(pauseOnHover) => {
            void setVideoSubtitlesConfig({ pauseOnHover })
          }}
        />
      </ConfigItem>
    </ConfigSection>
  )
}
