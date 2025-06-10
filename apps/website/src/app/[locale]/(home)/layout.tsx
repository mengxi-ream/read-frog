import type { ReactNode } from 'react'
import { HomeLayout } from 'fumadocs-ui/layouts/home'
import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { baseOptions, homeLinks } from '@/app/[locale]/layout.config'
import Footer from '@/components/footer'
import { routing } from '@/i18n/routing'

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  return (
    <HomeLayout
      {...baseOptions(locale)}
      links={homeLinks(locale)}
      className="pt-0"
    >
      {children}
      <Footer params={{ locale }} />
    </HomeLayout>
  )
}
