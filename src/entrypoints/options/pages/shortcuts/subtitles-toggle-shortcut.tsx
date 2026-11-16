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
      // The shortcut only does something on a site whose subtitles are on.
      turnOn={
        Object.values(videoSubtitles.platforms).some((mode) => mode !== "off")
          ? undefined
          : buildSectionLink("/video-subtitles/sites", "subtitles-sites")
      }
      shortcut={videoSubtitles.toggleShortcut}
      onChange={(nextShortcut) => {
        void setVideoSubtitles({ toggleShortcut: nextShortcut })
      }}
    />
  )
}
