import { i18n } from "@/utils/i18n"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { ConfigSection } from "../../../components/config-section"

/**
 * Prompts are written, imported and exported, not set — the same reason the page translation
 * ones live on a page of their own. The section only points at it.
 */
export function CustomPromptsSection() {
  return (
    <ConfigSection title={i18n.t("options.videoSubtitles.customPrompts.title")}>
      <ConfigNavItem
        to="/video-subtitles/prompts"
        title={i18n.t("options.videoSubtitles.customPrompts.managePrompts")}
        description={i18n.t("options.videoSubtitles.customPrompts.description")}
      />
    </ConfigSection>
  )
}
