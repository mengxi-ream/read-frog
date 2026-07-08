import { IconGripHorizontal } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { Activity } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SUBTITLES_VIEW_CLASS } from "@/utils/constants/subtitles"
import { cn } from "@/utils/styles/utils"
import { currentSubtitleAtom } from "../atoms"
import { MainSubtitle, TranslationSubtitle } from "./subtitle-lines"
import { useVerticalDrag } from "./use-vertical-drag"

interface SubtitlesViewProps {
  showContent: boolean
}

function SubtitlesContent() {
  const subtitle = useAtomValue(currentSubtitleAtom)
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const { displayMode, translationPosition, container } = style

  const translationAbove = translationPosition === "above"
  const showMain = displayMode !== "translationOnly"
  const isDuplicateTranslation = !!subtitle?.translation && subtitle.translation === subtitle.text
  const showTranslation =
    displayMode !== "originalOnly" && !(displayMode === "bilingual" && isDuplicateTranslation)

  const containerStyle = {
    backgroundColor: `rgba(0, 0, 0, ${container.backgroundOpacity / 100})`,
  }

  return (
    <div
      className={`${SUBTITLES_VIEW_CLASS} pointer-events-none flex w-full flex-col items-center justify-end pb-3`}
    >
      <div
        className="pointer-events-auto mx-auto flex w-fit max-w-[90%] cursor-text flex-col gap-2 rounded px-2 py-1.5 text-center text-white select-text"
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

export function SubtitlesView({ showContent }: SubtitlesViewProps) {
  const { refs, windowStyle, positionStyle, isDragging } = useVerticalDrag()

  return (
    <div
      ref={refs.window}
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
          "group absolute right-0 left-0 flex w-full flex-col items-center",
          !isDragging && "transition-[top,bottom] duration-200",
          !showContent && "invisible",
        )}
        style={positionStyle}
      >
        <div className="pointer-events-auto">
          <div
            ref={refs.handle}
            className="mb-0.5 cursor-grab rounded bg-black/75 px-2 py-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 active:cursor-grabbing active:opacity-100"
          >
            <IconGripHorizontal className="size-4 text-white" />
          </div>
        </div>

        <Activity mode={showContent ? "visible" : "hidden"}>
          <SubtitlesContent />
        </Activity>
      </div>
    </div>
  )
}
