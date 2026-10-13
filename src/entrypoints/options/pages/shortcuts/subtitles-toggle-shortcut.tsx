import { useAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { buildSectionLink } from "../../command-palette/section-scroll"
import { ShortcutConfigItem } from "./shortcut-config-item"

export function SubtitlesToggleShortcut() {
  const [videoSubtitles, setVideoSubtitles] = useAtom(configFieldsAtomMap.videoSubtitles)

  return (
    <ShortcutConfigItem
      id="subtitles-toggle-shortcut"
      title={i18n.t("options.shortcuts.subtitlesToggle.title")}
      description={i18n.t("options.shortcuts.subtitlesToggle.description")}
      turnOn={
        videoSubtitles.enabled
          ? undefined
          : buildSectionLink("/video-subtitles", "subtitles-enable")
      }
      shortcut={videoSubtitles.toggleShortcut}
      onChange={(nextShortcut) => {
        void setVideoSubtitles({ toggleShortcut: nextShortcut })
      }}
    />
  )
}
