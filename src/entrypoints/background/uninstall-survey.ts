import { browser, i18n } from '#imports'
import { EXTENSION_VERSION } from '@/utils/constants/app'

type BrowserType = 'chrome' | 'edge' | 'firefox'

function getBrowserVersion(browserType: string): string {
  const ua = globalThis.navigator?.userAgent ?? ''
  const type = browserType.toLowerCase() as BrowserType

  if (type === 'edge') {
    return ua.match(/Edg(?:e|A|iOS)?\/([\d.]+)/i)?.[1]
      ?? ua.match(/Edge\/([\d.]+)/i)?.[1]
      ?? 'unknown'
  }

  if (type === 'firefox')
    return ua.match(/Firefox\/([\d.]+)/i)?.[1] ?? 'unknown'

  if (type === 'chrome')
    return ua.match(/Chrome\/([\d.]+)/i)?.[1] ?? 'unknown'

  return ua.match(/(?:Edg|Edge|Firefox|Chrome)\/([\d.]+)/i)?.[1] ?? 'unknown'
}

function getOS(): string {
  const nav = globalThis.navigator as Navigator & {
    userAgentData?: {
      platform?: string
    }
  }
  const platform = `${nav.userAgentData?.platform ?? ''} ${nav.platform ?? ''} ${nav.userAgent ?? ''}`

  if (/iPhone|iPad|iPod|iOS/i.test(platform))
    return 'iOS'
  if (/Android/i.test(platform))
    return 'Android'
  if (/Windows/i.test(platform))
    return 'Windows'
  if (/Mac/i.test(platform))
    return 'MacOS'
  if (/Linux/i.test(platform))
    return 'Linux'
  return 'Unknown'
}

function getUILang(): string {
  const uiLang = browser.i18n.getUILanguage?.()
  return uiLang || globalThis.navigator?.language || 'unknown'
}

export async function setupUninstallSurvey() {
  const surveyUrl = i18n.t('uninstallSurveyUrl') as string
  const browserType = import.meta.env.BROWSER

  const url = new URL(surveyUrl)
  url.searchParams.set('rf_version', EXTENSION_VERSION)
  url.searchParams.set('browser_type', browserType)
  url.searchParams.set('browser_version', getBrowserVersion(browserType))
  url.searchParams.set('os', getOS())
  url.searchParams.set('ui_lang', getUILang())

  void browser.runtime.setUninstallURL(url.toString())
}
