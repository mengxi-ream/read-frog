import type { ControlsConfig } from "@/entrypoints/subtitles.content/platforms"
import { useAtomValue } from "jotai"
import { subtitlesDisplayAtom, subtitlesShowContentAtom, subtitlesShowStateAtom } from "../atoms"
import { StateMessage } from "./state-message"
import { SubtitlesView } from "./subtitles-view"

interface SubtitlesContainerProps {
  controlsConfig?: ControlsConfig
}

export function SubtitlesContainer({ controlsConfig }: SubtitlesContainerProps) {
  const { stateData, isVisible } = useAtomValue(subtitlesDisplayAtom)
  const showState = useAtomValue(subtitlesShowStateAtom)
  const showContent = useAtomValue(subtitlesShowContentAtom)

  if (!isVisible) {
    return null
  }

  return (
    <>
      <SubtitlesView controlsConfig={controlsConfig} showContent={showContent} />
      <StateMessage state={showState} message={stateData?.state === "error" ? stateData.message : undefined} />
    </>
  )
}
