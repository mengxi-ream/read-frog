import { useAtomValue } from "jotai"
import { subtitlesDisplayAtom, subtitlesShowContentAtom, subtitlesShowStateAtom } from "../atoms"
import { StateMessage } from "./state-message"
import { SubtitlesSettingsPanel } from "./subtitles-settings-panel"
import { SubtitlesView } from "./subtitles-view"

export function SubtitlesContainer() {
  const { stateData, isVisible } = useAtomValue(subtitlesDisplayAtom)
  const showState = useAtomValue(subtitlesShowStateAtom)
  const showContent = useAtomValue(subtitlesShowContentAtom)

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      <div className="absolute inset-0 z-10 overflow-visible">
        {isVisible && (
          <>
            <SubtitlesView showContent={showContent} />
            <StateMessage state={showState} message={stateData?.state === "error" ? stateData.message : undefined} />
          </>
        )}
      </div>

      <div className="absolute inset-0 z-40 overflow-visible">
        <SubtitlesSettingsPanel />
      </div>
    </div>
  )
}
