import { IconGripHorizontal } from "@tabler/icons-react"
import { useAtomValue, useSetAtom } from "jotai"
import { Activity, useRef } from "react"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getLanguageDirectionAndLang } from "@/utils/content/language-direction"
import { cn } from "@/utils/styles/utils"
import { currentSubtitleAtom } from "../atoms"
import { SubtitlesPair } from "./subtitle-lines"
import { useSubtitlesUI } from "./subtitles-ui-context"
import { useControlsInfo } from "./use-controls-visible"
import { useVerticalDrag } from "./use-vertical-drag"

interface SubtitlesViewProps {
  showContent: boolean
}

function SubtitlesContent() {
  const subtitle = useAtomValue(currentSubtitleAtom)
  const { style } = useAtomValue(configFieldsAtomMap.videoSubtitles)
  const { displayMode, translationPosition, container } = style
  const language = useAtomValue(configFieldsAtomMap.language)

  const translationAbove = translationPosition === "above"
  const showMain = displayMode !== "translationOnly"
  const isDuplicateTranslation = !!subtitle?.translation && subtitle.translation === subtitle.text
  const showTranslation = displayMode !== "originalOnly"
    && !(displayMode === "bilingual" && isDuplicateTranslation)

  if (!showMain && !showTranslation)
    return null

  const { dir, lang } = getLanguageDirectionAndLang(language.targetCode)

  return (
    <SubtitlesPair
      mainText={subtitle?.text ?? ""}
      mainStyle={style.main}
      translationText={subtitle?.translation ?? ""}
      translationStyle={style.translation}
      showMain={showMain}
      showTranslation={showTranslation}
      translationAbove={translationAbove}
      backgroundOpacity={container.backgroundOpacity}
      lineGap={style.lineGap}
      dir={dir}
      lang={lang}
    />
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
            style={{ transform: "translateY(-12px)" }}
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
