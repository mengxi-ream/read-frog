import type { PageTranslationManager } from './page-translation'
import hotkeys from 'hotkeys-js'
import { getLocalConfig } from '@/utils/config/storage'

export async function bindTranslationShortcutKey(pageTranslationManager: PageTranslationManager) {
  // Clear all existing hotkeys first
  hotkeys.unbind()

  const config = await getLocalConfig()
  if (!config)
    return

  const shortcut = config.translate.page.shortcut.join('+')

  hotkeys(shortcut, () => {
    void (async () => {
      const currentConfig = await getLocalConfig()
      if (!currentConfig)
        return

      if (pageTranslationManager.isActive) {
        pageTranslationManager.stop()
      }
      else {
        void pageTranslationManager.start()
      }
    })()
    return false
  })
}
