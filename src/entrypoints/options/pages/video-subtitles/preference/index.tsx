import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { subtitlesPlatformSchema } from "@/types/config/subtitles"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { ConfigSection } from "../../../components/config-section"
import { ShortcutLink } from "../../../components/shortcut-link"
import { SubtitlesPlatformIcon } from "./platform-icon"

/**
 * Whether subtitles get translated at all, when that starts, and whether AI re-cuts the lines
 * first — the settings every other section on the page only matters under. When translating
 * starts is set per platform, on the page the middle row opens; the logos on that row name the
 * platforms it covers.
 */
export function PreferenceSection() {
  const [videoSubtitlesConfig, setVideoSubtitlesConfig] = useAtom(
    configFieldsAtomMap.videoSubtitles,
  )

  return (
    <ConfigSection title={i18n.t("options.videoSubtitles.preference.title")}>
      <ConfigItem
        id="subtitles-enable"
        title={i18n.t("options.videoSubtitles.preference.enable.title")}
        description={
          <>
            {i18n.t("options.videoSubtitles.preference.enable.description")}
            <ShortcutLink sectionId="subtitles-toggle-shortcut" />
          </>
        }
      >
        <Switch
          checked={videoSubtitlesConfig.enabled}
          onCheckedChange={(enabled) => {
            void setVideoSubtitlesConfig({ enabled })
          }}
        />
      </ConfigItem>
      <ConfigNavItem
        to="/video-subtitles/auto-start"
        title={
          <span className="flex items-center gap-2">
            {i18n.t("options.videoSubtitles.preference.autoStart.title")}
            <span className="flex items-center gap-1.5">
              {subtitlesPlatformSchema.options.map((platform) => (
                <SubtitlesPlatformIcon key={platform} platform={platform} className="size-3.5" />
              ))}
            </span>
          </span>
        }
        description={i18n.t("options.videoSubtitles.preference.autoStart.description")}
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
    </ConfigSection>
  )
}
