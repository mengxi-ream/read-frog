import type { ReactNode } from 'react'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { hasLocale } from 'next-intl'
import { notFound } from 'next/navigation'
import { baseOptions } from '@/app/[locale]/layout.config'
import { routing } from '@/i18n/routing'
import { source } from '@/lib/source'

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
    <DocsLayout tree={source.pageTree[locale]} {...baseOptions(locale)}>
      {children}
    </DocsLayout>
  )
}
