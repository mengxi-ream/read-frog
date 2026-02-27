import type { ControlsConfig } from "@/entrypoints/subtitles.content/platforms"
import { Icon } from "@iconify/react"
import { useAtomValue } from "jotai"
import { Activity, useRef } from "react"
import { cn } from "@/lib/utils"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SUBTITLES_VIEW_CLASS } from "@/utils/constants/subtitles"
import { MainSubtitle, TranslationSubtitle } from "./subtitle-lines"
import { useControlsInfo } from "./use-controls-visible"
import { useVerticalDrag } from "./use-vertical-drag"

interface SubtitlesViewProps {
  controlsConfig?: ControlsConfig
  showContent: boolean
}

function SubtitlesContent() {
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const { displayMode, translationPosition, container } = style

  const translationAbove = translationPosition === "above"
  const showMain = displayMode !== "translationOnly"
  const showTranslation = displayMode !== "originalOnly"

  const containerStyle = {
    backgroundColor: `rgba(0, 0, 0, ${container.backgroundOpacity / 100})`,
  }

  return (
    <div className={`${SUBTITLES_VIEW_CLASS} flex w-full flex-col items-center justify-end pb-3 pointer-events-none`}>
      <div
        className="flex flex-col gap-2 w-fit max-w-[80%] mx-auto px-2 py-1.5 rounded text-center text-white pointer-events-auto select-text cursor-text"
        style={containerStyle}
      >
        <Activity mode={showMain ? "visible" : "hidden"}>
          <MainSubtitle className={translationAbove ? "order-2" : "order-1"} />
        </Activity>

        <Activity mode={showTranslation ? "visible" : "hidden"}>
          <TranslationSubtitle className={translationAbove ? "order-1" : "order-2"} />
        </Activity>
      </div>
    </div>
  )
}

export function SubtitlesView({ controlsConfig, showContent }: SubtitlesViewProps) {
  const windowRef = useRef<HTMLDivElement>(null)
  const { controlsVisible, controlsHeight } = useControlsInfo(windowRef, controlsConfig)
  const { refs, windowStyle, positionStyle, isDragging } = useVerticalDrag(controlsVisible, controlsHeight)

  return (
    <div
      ref={windowRef}
      style={{
        width: windowStyle.width,
        height: windowStyle.height,
        fontSize: windowStyle.fontSize,
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        ref={refs.container}
        className={cn(
          "group flex flex-col items-center absolute w-full left-0 right-0",
          !isDragging && "transition-[top,bottom] duration-200",
          !showContent && "invisible",
        )}
        style={positionStyle}
      >
        <div className="w-full flex justify-center pointer-events-auto">
          <div
            ref={refs.handle}
            className="mb-0.5 px-2 py-1 rounded cursor-grab active:cursor-grabbing bg-black/75 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity duration-200"
          >
            <Icon icon="tabler:grip-horizontal" className="size-4 text-white" />
          </div>
        </div>

        <Activity mode={showContent ? "visible" : "hidden"}>
          <SubtitlesContent />
        </Activity>
      </div>
    </div>
  )
}
