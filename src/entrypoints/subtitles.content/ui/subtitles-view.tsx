import type { SubtitleBlurMode } from "@/types/config/subtitles"
import { IconGripHorizontal } from "@tabler/icons-react"
import { useAtomValue, useSetAtom } from "jotai"
import { Activity, useEffect, useRef, useState } from "react"
import { subtitleBlurModeSchema } from "@/types/config/subtitles"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SUBTITLES_VIEW_CLASS } from "@/utils/constants/subtitles"
import { cn } from "@/utils/styles/utils"
import { currentSubtitleAtom } from "../atoms"
import { MainSubtitle, TranslationSubtitle } from "./subtitle-lines"
import { useSubtitlesUI } from "./subtitles-ui-context"
import { useControlsInfo } from "./use-controls-visible"
import { useVerticalDrag } from "./use-vertical-drag"

interface SubtitlesViewProps {
  showContent: boolean
}

function useBlurKey() {
  const [unBlurSubtitleTimes, setUnBlurSubtitleTimes] = useState(0)
  const currentSubtitle = useAtomValue(currentSubtitleAtom)
  const prevStartRef = useRef(currentSubtitle?.start)

  if (currentSubtitle?.start !== prevStartRef.current) {
    prevStartRef.current = currentSubtitle?.start
    setUnBlurSubtitleTimes(0)
  }
  useEffect(() => {
    document.addEventListener("keydown", handler)

    return () => {
      document.removeEventListener("keydown", handler)
    }

    function handler(e: KeyboardEvent) {
      if (e.key !== "e" || ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        return
      }

      e.preventDefault()

      setUnBlurSubtitleTimes(prev => prev + 1)
    }
  }, [setUnBlurSubtitleTimes])

  return unBlurSubtitleTimes
}

interface SubtitlesBlurState {
  blurMain: boolean
  blurTranslation: boolean
}
function computeSubtitleBlurState(blurMode: SubtitleBlurMode, unBlurSubtitleTimes: number): SubtitlesBlurState {
  const subtitleBlurModeEnum = subtitleBlurModeSchema.enum

  if (blurMode === subtitleBlurModeEnum.showAll) {
    return { blurMain: false, blurTranslation: false }
  }

  if (blurMode === subtitleBlurModeEnum.blurOnlyTranslation) {
    return { blurMain: false, blurTranslation: unBlurSubtitleTimes % 2 === 0 }
  }

  // 0 times: blur all, 1 time: blur translation only, 2 times: show all, 3 times: blur translation only,
  // 4 times: blur all 5 times: blur translation only, 6 times: show all, 7 times: blur translation only
  return {
    blurMain: unBlurSubtitleTimes % 4 === 0,
    blurTranslation: unBlurSubtitleTimes % 4 !== 2,
  }
}

function SubtitlesContent() {
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const { displayMode, translationPosition, container } = style
  const { blurMain, blurTranslation } = computeSubtitleBlurState(subtitleBlurModeSchema.enum.blurAll, useBlurKey())

  const translationAbove = translationPosition === "above"
  const showMain = displayMode !== "translationOnly"
  const showTranslation = displayMode !== "originalOnly"

  const containerStyle = {
    backgroundColor: `rgba(0, 0, 0, ${container.backgroundOpacity / 100})`,
  }

  return (
    <div className={`${SUBTITLES_VIEW_CLASS} flex w-full flex-col items-center justify-end pb-3 pointer-events-none`}>
      <div
        className="flex flex-col gap-2 w-fit max-w-[90%] mx-auto px-2 py-1.5 rounded text-center text-white pointer-events-auto select-text cursor-text"
        style={containerStyle}
      >
        <Activity mode={showMain ? "visible" : "hidden"}>
          <MainSubtitle blurred={blurMain} className={translationAbove ? "order-2" : "order-1"} />
        </Activity>

        <Activity mode={showTranslation ? "visible" : "hidden"}>
          <TranslationSubtitle blurred={blurTranslation} className={translationAbove ? "order-1" : "order-2"} />
        </Activity>
      </div>
    </div>
  )
}

export function SubtitlesView({ showContent }: SubtitlesViewProps) {
  const windowRef = useRef<HTMLDivElement>(null)
  const { controlsConfig } = useSubtitlesUI()
  const { controlsVisible, controlsHeight } = useControlsInfo(windowRef, controlsConfig)
  const setVideoSubtitles = useSetAtom(configFieldsAtomMap.videoSubtitles)

  const { refs, windowStyle, positionStyle, isDragging } = useVerticalDrag({
    controlsVisible,
    controlsHeight,
    onDragEnd: pos => void setVideoSubtitles({ position: pos }),
  })

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
