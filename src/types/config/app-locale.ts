import z from "zod"

export const appLocales = ["system", "en", "zh_CN", "zh_TW", "ja", "ko", "ru", "tr", "vi"] as const
export type AppLocale = (typeof appLocales)[number]
export const appLocaleSchema = z.enum(appLocales)
export const DEFAULT_APP_LOCALE: AppLocale = "system"
