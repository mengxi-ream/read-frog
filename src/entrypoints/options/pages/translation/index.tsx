import { i18n } from "#imports"
import { PageLayout } from "../../components/page-layout"
import { AutoTranslateLanguages } from "./auto-translate-languages"
import { AutoTranslateWebsitePatterns } from "./auto-translate-website-patterns"
import { ClearCacheConfig } from "./clear-cache-config"
import { CustomTranslationStyle } from "./custom-translation-style"
import { NeverAutoTranslateWebsitePatterns } from "./never-auto-translate-website-patterns"
import { NodeTranslationHotkey } from "./node-translation-hotkey"
import { PageTranslationShortcut } from "./page-translation-shortcut"
import { PreloadConfig } from "./preload-config"
import { RequestBatch } from "./request-batch"
import { RequestRate } from "./request-rate"
import { SkipLanguages } from "./skip-languages"
import { SmallParagraphFilter } from "./small-paragraph-filter"
import { TranslateRange } from "./translate-range"

export function TranslationPage() {
  return (
    <PageLayout title={i18n.t("options.translation.title")} innerClassName="*:border-b [&>*:last-child]:border-b-0">
      <TranslateRange />
      <PageTranslationShortcut />
      <NodeTranslationHotkey />
      <CustomTranslationStyle />
      <AutoTranslateWebsitePatterns />
      <NeverAutoTranslateWebsitePatterns />
      <AutoTranslateLanguages />
      <SkipLanguages />
      <RequestRate />
      <RequestBatch />
      <PreloadConfig />
      <SmallParagraphFilter />
      <ClearCacheConfig />
    </PageLayout>
  )
}
