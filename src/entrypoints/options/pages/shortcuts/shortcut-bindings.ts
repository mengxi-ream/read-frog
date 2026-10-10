import type { Config } from "@/types/config/config"
import { getSpeakShortcut } from "@/utils/constants/selection"
import { getSelectionToolbarActions } from "@/utils/custom-actions"
import { i18n } from "@/utils/i18n"
import { isSameShortcut } from "@/utils/shortcut"

/** One recorded key combination on the Shortcuts page, by the id of its row. */
export interface ShortcutBinding {
  id: string
  title: string
  shortcut: string
}

export function getActionShortcutId(actionId: string) {
  return `action-shortcut-${actionId}`
}

/**
 * Every key combination Read Frog listens for on a page. They all hear the same keystrokes, so
 * two of them on one key would both run. Paragraph translation is left out: it is a modifier
 * held while hovering, not a combination.
 */
export function getShortcutBindings(config: Config): ShortcutBinding[] {
  const { features } = config.selectionToolbar
  return [
    {
      id: "page-translation-shortcut",
      title: i18n.t("options.shortcuts.pageTranslation.title"),
      shortcut: config.pageTranslation.page.shortcut,
    },
    {
      id: "translation-mode-shortcut",
      title: i18n.t("options.shortcuts.translationMode.title"),
      shortcut: config.pageTranslation.modeShortcut,
    },
    {
      id: "selection-translation-shortcut",
      title: i18n.t("options.shortcuts.selectionTranslation.title"),
      shortcut: features.translate.shortcut,
    },
    {
      id: "selection-speak-shortcut",
      title: i18n.t("options.shortcuts.selectionSpeak.title"),
      shortcut: getSpeakShortcut(features.speak),
    },
    {
      id: "subtitles-toggle-shortcut",
      title: i18n.t("options.shortcuts.subtitlesToggle.title"),
      shortcut: config.videoSubtitles.toggleShortcut,
    },
    {
      id: "translation-hub-shortcut",
      title: i18n.t("options.shortcuts.translationHub.title"),
      shortcut: config.translationHub.shortcut,
    },
    ...getSelectionToolbarActions(config.selectionToolbar).map((action) => ({
      id: getActionShortcutId(action.id),
      title: action.name,
      shortcut: action.shortcut ?? "",
    })),
  ]
}

/** The other binding already on these keys, if one is. */
export function findShortcutOwner(
  bindings: ShortcutBinding[],
  id: string,
  shortcut: string,
): ShortcutBinding | undefined {
  return bindings.find((binding) => binding.id !== id && isSameShortcut(binding.shortcut, shortcut))
}
