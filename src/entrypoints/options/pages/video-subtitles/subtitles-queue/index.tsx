import { i18n } from "@/utils/i18n"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { ConfigSection } from "../../../components/config-section"

/**
 * The dials on the subtitle requests themselves — how fast they go out and how many lines each
 * carries. Four number fields nobody touches on the way to anything else, so the section points
 * at the page holding them rather than spending the room here.
 */
export function SubtitlesQueueSection() {
  return (
    <ConfigSection title={i18n.t("options.videoSubtitles.subtitlesQueue.title")}>
      <ConfigNavItem
        to="/video-subtitles/subtitles-queue"
        title={i18n.t("options.videoSubtitles.subtitlesQueue.manageQueue")}
        description={i18n.t("options.videoSubtitles.subtitlesQueue.description")}
      />
    </ConfigSection>
  )
}
