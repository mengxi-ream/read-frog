import { defineRouting } from 'next-intl/routing'

export const locales = ['en', 'zh'] as const
export type Locale = (typeof locales)[number]

export const routing = defineRouting({
  // A list of all locales that are supported
  locales,

  // Used when no locale matches
  defaultLocale: 'en',
})
