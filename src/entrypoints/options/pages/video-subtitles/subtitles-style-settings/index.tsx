import { i18n } from "#imports"
import { ConfigCard } from "../../../components/config-card"
import { GeneralSettings } from "./components/general-settings"
import { MainSubtitlesStyle } from "./components/main-subtitles-style"
import { TranslationSubtitlesStyle } from "./components/translation-subtitles-style"

export function SubtitlesStyleSettings() {
  return (
    <ConfigCard
      id="subtitles-style"
      className="lg:flex-col"
      title={i18n.t("options.videoSubtitles.style.title")}
      description={i18n.t("options.videoSubtitles.style.description")}
    >
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <GeneralSettings />
        <MainSubtitlesStyle />
        <TranslationSubtitlesStyle />
      </div>
    </ConfigCard>
  )
}
