import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { ShortcutLink } from "../../../components/shortcut-link"

/**
 * Whether subtitles get translated at all, when that starts, and whether AI re-cuts the lines
 * first — the three switches every other section on the page only matters under.
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
      <ConfigItem
        id="subtitles-auto-start"
        title={i18n.t("options.videoSubtitles.preference.autoStart.title")}
        description={i18n.t("options.videoSubtitles.preference.autoStart.description")}
      >
        <Switch
          checked={videoSubtitlesConfig.autoStart}
          onCheckedChange={(autoStart) => {
            void setVideoSubtitlesConfig({ autoStart })
          }}
        />
      </ConfigItem>
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
