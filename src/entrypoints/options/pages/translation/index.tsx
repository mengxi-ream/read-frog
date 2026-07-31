import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { AutoTranslateLanguages } from "./auto-translate-languages"
import { AutoTranslateWebsitePatterns } from "./auto-translate-website-patterns"
import { ClearCacheConfig } from "./clear-cache-config"
import { HoverTranslationSection } from "./hover-translation"
import { NeverAutoTranslateWebsitePatterns } from "./never-auto-translate-website-patterns"
import { PersonalizedPromptsSection } from "./personalized-prompts"
import { PreferenceSection } from "./preference"
import { PreloadConfig } from "./preload-config"
import { RequestBatch } from "./request-batch"
import { RequestRate } from "./request-rate"
import { SkipLanguages } from "./skip-languages"
import { SmallParagraphFilter } from "./small-paragraph-filter"
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
      {/* Everything below still predates sections and keeps the card list it was written for. */}
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <AutoTranslateWebsitePatterns />
        <NeverAutoTranslateWebsitePatterns />
        <AutoTranslateLanguages />
        <SkipLanguages />
        <RequestRate />
        <RequestBatch />
        <PreloadConfig />
        <SmallParagraphFilter />
        <ClearCacheConfig />
      </div>
    </PageLayout>
  )
}
