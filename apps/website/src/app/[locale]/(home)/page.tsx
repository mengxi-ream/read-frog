import type { Locale } from '@/i18n/routing'
import { setRequestLocale } from 'next-intl/server'
import { use } from 'react'
import { Features } from '@/components/features/features'
import { Demo } from '@/components/hero/demo/index'
import { Header } from '@/components/hero/header'
import { Recall } from '@/components/recall'
import { ClientLogos } from '@/components/social/client-logos'
import { Testimonial } from '@/components/social/testimonial'

export default function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = use(params)
  setRequestLocale(locale)

  return (
    <main className="flex flex-1 flex-col dark:bg-[#18181b]">
      <Header />
      <Demo />
      <ClientLogos />
      <Features />
      <Testimonial />
      <Recall />
    </main>
  )
}
