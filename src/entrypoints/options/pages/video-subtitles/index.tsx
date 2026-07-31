import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { AiQuotaSection } from "./ai-quota"
import { CacheSection } from "./cache"
import { CustomPromptsSection } from "./custom-prompts"
import { PreferenceSection } from "./preference"
import { SubtitlesQueueSection } from "./subtitles-queue"
import { SubtitlesStyleSection } from "./subtitles-style"

export function VideoSubtitlesPage() {
  return (
    <PageLayout
      title={i18n.t("options.videoSubtitles.title")}
      description={i18n.t("options.videoSubtitles.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <PreferenceSection />
      <AiQuotaSection />
      <SubtitlesStyleSection />
      <CustomPromptsSection />
      <SubtitlesQueueSection />
      <CacheSection />
    </PageLayout>
  )
}
