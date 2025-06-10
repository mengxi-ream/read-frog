import type { Locale } from '@/i18n/routing'
import { setRequestLocale } from 'next-intl/server'
import { use } from 'react'
import { Demo } from '@/components/hero/demo'
import { Header } from '@/components/hero/header'

export default function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = use(params)
  setRequestLocale(locale)
  // const t = useTranslations("home");

  return (
    <main className="flex flex-1 flex-col dark:bg-[#18181b]">
      <Header />
      <Demo />
      {/* <p>{t("title")}</p> */}
    </main>
  )
}
