import { DownloadSourceSubtitles } from "./components/download-source-subtitles"
import { SettingsPanelShell } from "./components/settings-panel-shell"
import { SubtitlesToggle } from "./components/subtitles-toggle"

export function SubtitlesSettingsPanel() {
  return (
    <SettingsPanelShell>
      <SubtitlesToggle />
      <DownloadSourceSubtitles />
    </SettingsPanelShell>
  )
}
