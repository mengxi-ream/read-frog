import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { ActionShortcuts } from "./action-shortcuts"
import { NodeTranslationHotkey } from "./node-translation-hotkey"
import { PageTranslationShortcut } from "./page-translation-shortcut"
import { SelectionSpeakShortcut } from "./selection-speak-shortcut"
import { SelectionTranslationShortcut } from "./selection-translation-shortcut"
import { SubtitlesToggleShortcut } from "./subtitles-toggle-shortcut"
import { TranslationHubShortcut } from "./translation-hub-shortcut"
import { TranslationModeShortcut } from "./translation-mode-shortcut"

/**
 * The reading shortcuts in one flat list: few enough that headings between them would only
 * get in the way. They come first, narrowing scope as the list goes down; the Translation Hub
 * row is last of them because it opens a page instead of acting on what is already on screen.
 * The AI actions follow under a heading of their own: there is one row per action, as many
 * as the user has made.
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
      <SelectionSpeakShortcut />
      <SubtitlesToggleShortcut />
      <NodeTranslationHotkey />
      <TranslationHubShortcut />
      <ActionShortcuts />
    </PageLayout>
  )
}
