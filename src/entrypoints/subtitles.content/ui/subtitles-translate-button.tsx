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
        setPanelOpen(prev => !prev)
      }}
      className={cn(
        `${TRANSLATE_BUTTON_CLASS} w-12 h-full flex items-center justify-center relative border-none p-0 m-0 cursor-pointer rounded-[14px] transition-all duration-200`,
        panelOpen
          ? "bg-accent shadow-inner"
          : "bg-transparent",
      )}
    >
      <img
        src={logo}
        alt="Subtitle Toggle"
        className={cn(
          "w-8 h-8 transition-all duration-200 object-contain block",
          isVisible ? "opacity-100 saturate-110" : "opacity-75 saturate-90",
          panelOpen && "scale-[1.02]",
        )}
      />
      <div
        className={cn(
          "absolute bottom-1 right-0 min-w-7 px-1 py-0.5 rounded-md text-[8px] font-semibold leading-none tracking-[0.08em] text-center transition-colors duration-200",
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
