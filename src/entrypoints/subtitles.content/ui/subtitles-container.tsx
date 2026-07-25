import { useAtomValue } from "jotai"
import { use } from "react"
import { subtitlesDisplayAtom, subtitlesShowContentAtom, subtitlesShowStateAtom } from "../atoms"
import { StateMessage } from "./state-message"
import { SubtitlesSettingsPanel } from "./subtitles-settings-panel"
import { SubtitlesUIContext } from "./subtitles-ui-context"
import { SubtitlesView } from "./subtitles-view"

export function SubtitlesContainer() {
  const { stateData, isVisible } = useAtomValue(subtitlesDisplayAtom)
  const showState = useAtomValue(subtitlesShowStateAtom)
  const showContent = useAtomValue(subtitlesShowContentAtom)
  const ui = use(SubtitlesUIContext)

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      <div className="absolute inset-0 z-10 overflow-visible">
        {isVisible && (
          <>
            <SubtitlesView showContent={showContent} />
            <StateMessage state={showState} message={stateData?.message} />
          </>
        )}
      </div>

      {(!ui?.embedded || ui?.openBelow) && (
        <div className="absolute inset-0 z-40 overflow-visible">
          <SubtitlesSettingsPanel />
        </div>
      )}
    </div>
  )
}
