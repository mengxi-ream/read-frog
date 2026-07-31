import { i18n } from "@/utils/i18n"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { ConfigSection } from "../../../components/config-section"

/**
 * How subtitles look on the video. A preview with three panels of fonts, colors and sliders is
 * far more than a settings row can hold, so the section only points at the page that holds it.
 */
export function SubtitlesStyleSection() {
  return (
    <ConfigSection title={i18n.t("options.videoSubtitles.style.title")}>
      <ConfigNavItem
        to="/video-subtitles/style"
        title={i18n.t("options.videoSubtitles.style.customizeStyle")}
        description={i18n.t("options.videoSubtitles.style.description")}
      />
    </ConfigSection>
  )
}
