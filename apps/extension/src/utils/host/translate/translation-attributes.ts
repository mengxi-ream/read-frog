import type { Config } from '@/types/config/config'
import { ISO6393_TO_6391, RTL_LANG_CODES } from '@repo/definitions'

export function setTranslationDirAndLang(element: HTMLElement, config: Config): void {
  const dir = RTL_LANG_CODES.includes(config.language.targetCode as typeof RTL_LANG_CODES[number]) ? 'rtl' : 'ltr'
  element.setAttribute('dir', dir)
  const langAttr = ISO6393_TO_6391[config.language.targetCode]
  if (langAttr)
    element.setAttribute('lang', langAttr)
}
