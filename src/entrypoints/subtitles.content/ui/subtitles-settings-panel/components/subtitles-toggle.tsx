import { i18n } from "#imports"
import { useAtomValue } from "jotai"
import { Label } from "@/components/ui/base-ui/label"
import { Switch } from "@/components/ui/base-ui/switch"
import { APP_NAME } from "@/utils/constants/app"
import { subtitlesVisibleAtom } from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"

export function SubtitlesToggle() {
  const title = `${APP_NAME} ${i18n.t("options.videoSubtitles.title")}`
  const switchId = "read-frog-subtitles-toggle"

  const isVisible = useAtomValue(subtitlesVisibleAtom)
  const { toggleSubtitles } = useSubtitlesUI()

  return (
    <div className="flex items-center gap-3 rounded-[14px] px-2 py-1 transition-colors hover:bg-white/4.5">
      <Label
        htmlFor={switchId}
        className="font-light! min-w-0 flex-1 cursor-pointer rounded-md px-2 py-0.5 text-left text-white/96 transition-colors hover:text-white"
      >
        <div className="text-[13px] leading-5 text-white/96">
          {title}
        </div>
      </Label>

      <Switch
        id={switchId}
        checked={isVisible}
        onCheckedChange={checked => toggleSubtitles(checked)}
        aria-label={title}
        className="data-checked:bg-[#d8a94b] data-unchecked:bg-white/14 border-white/12 shadow-none"
      />
    </div>
  )
}
