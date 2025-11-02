import type { Config } from '@/types/config/config'
import { RTL_LANG_CODES } from '@repo/definitions'

export function setTranslationDir(element: HTMLElement, config: Config): void {
  const dir = RTL_LANG_CODES.includes(config.language.targetCode as typeof RTL_LANG_CODES[number]) ? 'rtl' : 'ltr'
  element.setAttribute('dir', dir)
}
