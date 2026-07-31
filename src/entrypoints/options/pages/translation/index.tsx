import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { ClearCacheConfig } from "./clear-cache-config"
import { HoverTranslationSection } from "./hover-translation"
import { PersonalizedPromptsSection } from "./personalized-prompts"
import { PreferenceSection } from "./preference"
import { PreloadConfig } from "./preload-config"
import { RequestBatch } from "./request-batch"
import { RequestRate } from "./request-rate"
import { TranslateControlSection } from "./translate-control"
import { TranslationStyleSection } from "./translation-style"

export function TranslationPage() {
  return (
    <PageLayout
      title={i18n.t("options.translation.title")}
      description={i18n.t("options.translation.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <PreferenceSection />
      <HoverTranslationSection />
      <TranslationStyleSection />
      <PersonalizedPromptsSection />
      <TranslateControlSection />
      {/* Everything below still predates sections and keeps the card list it was written for. */}
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <RequestRate />
        <RequestBatch />
        <PreloadConfig />
        <ClearCacheConfig />
      </div>
    </PageLayout>
  )
}
