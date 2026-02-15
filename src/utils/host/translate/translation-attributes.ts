import type { Config } from '@/types/config/config'
import { getLanguageDirectionAndLang } from '@/utils/content/language-direction'

export function setTranslationDirAndLang(element: HTMLElement, config: Config): void {
  const { dir, lang } = getLanguageDirectionAndLang(config.language.targetCode)
  element.setAttribute('dir', dir)

  if (lang) {
    element.setAttribute('lang', lang)
  }
}
