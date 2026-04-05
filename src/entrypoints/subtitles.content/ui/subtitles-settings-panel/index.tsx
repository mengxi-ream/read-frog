import { SettingsPanelShell } from "./components/settings-panel-shell"
import { SubtitlesToggle } from "./components/subtitles-toggle"

export function SubtitlesSettingsPanel() {
  return (
    <SettingsPanelShell>
      <SubtitlesToggle />
    </SettingsPanelShell>
  )
}
