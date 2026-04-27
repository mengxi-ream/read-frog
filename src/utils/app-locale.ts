import type { AppLocale } from "@/types/config/app-locale"
import { browser, i18n, storage } from "#imports"
import { appLocaleSchema, DEFAULT_APP_LOCALE } from "@/types/config/app-locale"
import { APP_LOCALE_STORAGE_KEY } from "./constants/config"

interface MessageEntry {
  message?: string
}

type Messages = Record<string, MessageEntry>
type LocaleMessages = Exclude<AppLocale, "system">
type TranslateFunction = (key: string, ...args: unknown[]) => string

let activeMessages: Messages | null = null
let originalT: TranslateFunction | null = null
const messagesCache = new Map<LocaleMessages, Messages>()

export async function getLocalAppLocale(): Promise<AppLocale> {
  const locale = await storage.getItem<AppLocale>(`local:${APP_LOCALE_STORAGE_KEY}`)
  const parsed = appLocaleSchema.safeParse(locale)
  return parsed.success ? parsed.data : DEFAULT_APP_LOCALE
}

export async function setLocalAppLocale(locale: AppLocale): Promise<void> {
  await storage.setItem(`local:${APP_LOCALE_STORAGE_KEY}`, locale)
}

export async function initializeAppLocale(): Promise<void> {
  await applyAppLocale(await getLocalAppLocale())
}

export async function applyAppLocale(locale: AppLocale): Promise<void> {
  patchI18n()

  if (locale === "system") {
    activeMessages = null
    return
  }

  try {
    activeMessages = await loadMessages(locale)
  }
  catch (error) {
    console.warn(`[i18n] Failed to load app locale "${locale}", falling back to browser language.`, error)
    activeMessages = null
  }
}

async function loadMessages(locale: LocaleMessages): Promise<Messages> {
  const cached = messagesCache.get(locale)
  if (cached)
    return cached

  const url = browser.runtime.getURL(`/_locales/${locale}/messages.json` as Parameters<typeof browser.runtime.getURL>[0])
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`Failed to load locale messages: ${locale}`)

  const messages = await response.json() as Messages
  messagesCache.set(locale, messages)
  return messages
}

function patchI18n() {
  if (originalT)
    return

  originalT = i18n.t as TranslateFunction

  i18n.t = ((key, ...args) => {
    if (!activeMessages)
      return originalT!(key, ...args)

    let substitutions: string[] | undefined
    let count: number | undefined

    args.forEach((arg, index) => {
      if (arg == null) {
        return
      }
      if (typeof arg === "number") {
        count = arg
        return
      }
      if (Array.isArray(arg)) {
        substitutions = arg.map(String)
        return
      }
      throw new Error(`Unknown argument at index ${index}.`)
    })

    if (count != null && substitutions == null)
      substitutions = [String(count)]

    const messageName = String(key).replaceAll(".", "_")
    const message = activeMessages[messageName]?.message
    if (!message)
      return originalT!(key, ...args)

    const localizedMessage = applySubstitutions(message, substitutions)
    if (count == null)
      return localizedMessage

    const plural = localizedMessage.split(" | ")
    switch (plural.length) {
      case 1:
        return plural[0]
      case 2:
        return plural[count === 1 ? 0 : 1]
      case 3:
        return plural[count === 0 || count === 1 ? count : 2]
      default:
        throw new Error("Unknown plural formatting")
    }
  }) as typeof i18n.t
}

function applySubstitutions(message: string, substitutions: string[] | undefined) {
  if (!substitutions?.length)
    return message

  return substitutions.reduce(
    (result, substitution, index) => result.replaceAll(`$${index + 1}`, substitution),
    message,
  )
}
