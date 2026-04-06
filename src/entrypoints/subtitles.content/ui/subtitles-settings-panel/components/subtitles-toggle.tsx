import { i18n } from "#imports"
import { IconSubtitles } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { APP_NAME } from "@/utils/constants/app"
import { subtitlesVisibleAtom } from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { SubtitlesSettingsItem } from "./subtitles-settings-item"

export function SubtitlesToggle() {
  const title = `${APP_NAME} ${i18n.t("options.videoSubtitles.title")}`
  const switchId = "read-frog-subtitles-toggle"

  const isVisible = useAtomValue(subtitlesVisibleAtom)
  const { toggleSubtitles } = useSubtitlesUI()

  return (
    <SubtitlesSettingsItem
      icon={<IconSubtitles className="size-4" />}
      label={title}
      labelFor={switchId}
    >
      <Switch
        id={switchId}
        checked={isVisible}
        onCheckedChange={checked => toggleSubtitles(checked)}
        aria-label={title}
        className="data-checked:bg-[#d8a94b] data-unchecked:bg-white/14 border-white/12 shadow-none"
      />
    </SubtitlesSettingsItem>
  )
}
