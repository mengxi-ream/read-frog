import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../../components/config-detail-section"
import { ConfigNavItem } from "../../../../components/config-nav-item"
import { PageLayout } from "../../../../components/page-layout"
import { GeneralSettings } from "./general-settings"
import { MainSubtitlesStyle } from "./main-subtitles-style"
import { SubtitlesPreview } from "./subtitles-preview"
import { TranslationSubtitlesStyle } from "./translation-subtitles-style"

/**
 * The subtitle style editor, drilled into from the Video Subtitles page: a live preview above
 * three panels — the layout, and one for each of the two lines. Far too tall for a row. Anything
 * the panels cannot express is a page further in, behind the custom CSS row at the bottom.
 */
export function SubtitlesStylePage() {
  return (
    <PageLayout
      title={i18n.t("options.videoSubtitles.title")}
      description={i18n.t("options.videoSubtitles.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/video-subtitles"
        title={<span id="subtitles-style">{i18n.t("options.videoSubtitles.style.title")}</span>}
      >
        <SubtitlesPreview />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <GeneralSettings />
          <MainSubtitlesStyle />
          <TranslationSubtitlesStyle />
        </div>
        <ConfigNavItem
          to="/video-subtitles/style/custom-css"
          title={i18n.t("options.videoSubtitles.style.customCSS.title")}
          description={i18n.t("options.videoSubtitles.style.customCSS.description")}
        />
      </ConfigDetailSection>
    </PageLayout>
  )
}
