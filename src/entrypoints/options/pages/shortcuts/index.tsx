import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { NodeTranslationHotkey } from "./node-translation-hotkey"
import { PageTranslationShortcut } from "./page-translation-shortcut"
import { SelectionTranslationShortcut } from "./selection-translation-shortcut"
import { SubtitlesToggleShortcut } from "./subtitles-toggle-shortcut"
import { TranslationHubShortcut } from "./translation-hub-shortcut"
import { TranslationModeShortcut } from "./translation-mode-shortcut"

/**
 * Every shortcut in one flat list. The page is short enough that sections would only add
 * headings between four rows. Reading shortcuts come first, narrowing scope as the list
 * goes down; the Translation Hub row is last because it opens a page instead of acting on
 * what is already on screen.
 */
export function ShortcutsPage() {
  return (
    <PageLayout
      title={i18n.t("options.shortcuts.title")}
      description={i18n.t("options.shortcuts.pageDescription")}
      innerClassName="flex flex-col gap-6"
    >
      <PageTranslationShortcut />
      <TranslationModeShortcut />
      <SelectionTranslationShortcut />
      <SubtitlesToggleShortcut />
      <NodeTranslationHotkey />
      <TranslationHubShortcut />
    </PageLayout>
  )
}
