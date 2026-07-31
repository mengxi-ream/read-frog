import type { Hotkey } from "@tanstack/hotkeys"
import type { SubtitlesProvidersAdapter } from "./universal-adapter"
import { HotkeyManager } from "@tanstack/hotkeys"
import { toastManager } from "@/components/ui/base-ui/toast"
import { getLocalConfig } from "@/utils/config/storage"
import { i18n } from "@/utils/i18n"
import {
  isPageTranslationShortcutEmpty,
  isValidConfiguredPageTranslationShortcut,
} from "@/utils/page-translation-shortcut"
import { subtitlesStore, subtitlesVisibleAtom } from "./atoms"

const NOOP = () => {}

/**
 * Keyboard equivalent of the on/off switch in the subtitles panel: it flips the same
 * runtime visibility the player button does, so turning it off puts the site's own
 * captions back and stops translating.
 *
 * Like the other shortcuts, the key is read once at bind time - rebinding it takes
 * effect on the next page load.
 */
export async function bindSubtitlesToggleShortcut(
  adapter: SubtitlesProvidersAdapter,
): Promise<() => void> {
  const config = await getLocalConfig()
  const shortcut = config?.videoSubtitles?.toggleShortcut
  if (!shortcut || isPageTranslationShortcutEmpty(shortcut)) {
    return NOOP
  }

  if (!isValidConfiguredPageTranslationShortcut(shortcut)) {
    return NOOP
  }

  const registration = HotkeyManager.getInstance().register(
    shortcut as Hotkey,
    () => {
      const nextVisible = !subtitlesStore.get(subtitlesVisibleAtom)
      adapter.toggleSubtitlesByShortcut(nextVisible)

      toastManager.add({
        type: "info",
        title: i18n.t(nextVisible ? "subtitles.toggle.enabled" : "subtitles.toggle.disabled"),
      })
    },
    {
      ignoreInputs: true,
      preventDefault: true,
      stopPropagation: true,
    },
  )

  return () => {
    registration.unregister()
  }
}
