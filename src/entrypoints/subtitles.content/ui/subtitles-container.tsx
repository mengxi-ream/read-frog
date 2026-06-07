import { useAtomValue } from "jotai"
import { subtitlesDisplayAtom, subtitlesShowContentAtom } from "../atoms"
import { SubtitlesView } from "./subtitles-view"

export function SubtitlesContainer() {
  const { isVisible } = useAtomValue(subtitlesDisplayAtom)
  const showContent = useAtomValue(subtitlesShowContentAtom)

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      <div className="absolute inset-0 overflow-visible">
        {isVisible && (
          <SubtitlesView showContent={showContent} />
        )}
      </div>
    </div>
  )
}
