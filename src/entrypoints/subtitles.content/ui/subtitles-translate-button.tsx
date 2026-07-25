import { useAtomValue, useSetAtom } from "jotai"
import logo from "@/assets/icons/read-frog.png"
import { TRANSLATE_BUTTON_CLASS } from "@/utils/constants/subtitles"
import { cn } from "@/utils/styles/utils"
import {
  subtitlesSettingsPanelOpenAtom,
  subtitlesSettingsPanelViewAtom,
  subtitlesStore,
  subtitlesVisibleAtom,
} from "../atoms"
import { ROOT_VIEW } from "./subtitles-settings-panel/views"

export function SubtitlesTranslateButton() {
  const isVisible = useAtomValue(subtitlesVisibleAtom, { store: subtitlesStore })
  const panelOpen = useAtomValue(subtitlesSettingsPanelOpenAtom, { store: subtitlesStore })
  const setPanelOpen = useSetAtom(subtitlesSettingsPanelOpenAtom, { store: subtitlesStore })
  const setPanelView = useSetAtom(subtitlesSettingsPanelViewAtom, { store: subtitlesStore })

  return (
    <button
      type="button"
      aria-label="Subtitle Translation Panel"
      aria-pressed={panelOpen}
      onClick={() => {
        setPanelView(ROOT_VIEW)
        setPanelOpen((prev) => !prev)
      }}
      className={cn(
        `${TRANSLATE_BUTTON_CLASS} relative m-0 flex h-full w-12 cursor-pointer items-center justify-center rounded-[14px] border-none p-0 transition-all duration-200`,
        panelOpen ? "bg-accent shadow-inner" : "bg-transparent",
      )}
    >
      <img
        src={logo}
        alt="Subtitle Toggle"
        className={cn(
          "block h-8 w-8 object-contain transition-all duration-200",
          isVisible ? "opacity-100 saturate-110" : "opacity-75 saturate-90",
          panelOpen && "scale-[1.02]",
        )}
      />
      <div
        className={cn(
          "absolute right-0 bottom-1 min-w-7 rounded-md px-1 py-0.5 text-center text-[8px] leading-none font-semibold tracking-[0.08em] transition-colors duration-200",
          isVisible
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {isVisible ? "ON" : "OFF"}
      </div>
    </button>
  )
}
