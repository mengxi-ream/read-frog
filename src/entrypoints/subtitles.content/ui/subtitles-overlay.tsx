import { useAtomValue } from "jotai"
import { subtitlesDisplayAtom, subtitlesShowStateAtom } from "../atoms"
import { StateMessage } from "./state-message"
import { SubtitlesSettingsPanel } from "./subtitles-settings-panel"

export function SubtitlesOverlay() {
  const { stateData, isVisible } = useAtomValue(subtitlesDisplayAtom)
  const showState = useAtomValue(subtitlesShowStateAtom)

  return (
    <>
      <SubtitlesSettingsPanel />
      {isVisible && (
        <StateMessage
          state={showState}
          message={stateData?.state === "error" ? stateData.message : undefined}
        />
      )}
    </>
  )
}
