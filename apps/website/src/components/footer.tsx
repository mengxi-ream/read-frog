import type { Locale } from '@/i18n/routing'
import { cn } from '@repo/ui/lib/utils'
import { useTranslations } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import Image from 'next/image'
import Link from 'next/link'
import { Container } from '@/components/container'

const navigation = {
  contact: [
    { name: 'feedback', href: 'https://wj.qq.com/s2/22031975/aea0/' },
    { name: 'businessPartnership', href: 'mailto:contact@mengxi.work' },
  ],
  legal: [
    { name: 'termsOfService', href: '/terms-of-service' },
    { name: 'privacyPolicy', href: '/privacy-policy' },
  ],
  community: [
    { name: 'github', href: 'https://github.com/mengxi-ream/read-frog' },
    {
      name: 'wechat',
      href: '/images/wechat-account.jpg',
    },
    {
      name: 'discord',
      href: 'https://discord.gg/ej45e3PezJ',
    },
  ],
}

export default function Footer({
  params,
  className,
}: {
  params: { locale: Locale }
  className?: string
}) {
  const { locale } = params
  setRequestLocale(locale)
  const t = useTranslations('footer')

  return (
    <footer
      className={cn(
        'border-t border-zinc-200 bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-800',
        className,
      )}
    >
      <Container className="py-16">
        <div className="flex flex-col items-start justify-between gap-x-8 gap-y-8 md:flex-row">
          <div className="flex flex-1 flex-col gap-y-2">
            <Image src="/logo.png" alt="Read Frog" className="size-8" width={32} height={32} />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('description')}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              {t('copyright', { year: new Date().getFullYear() })}
            </p>
          </div>

          <nav className="flex w-full flex-col justify-between gap-8 sm:flex-row sm:gap-12 md:w-auto">
            {Object.entries(navigation).map(([category, items]) => (
              <div key={category} className="shrink-0">
                <h3 className="text-sm font-semibold capitalize text-gray-900 dark:text-gray-100">
                  {t(category)}
                </h3>
                <ul className="mt-4 space-y-2">
                  {items.map(item => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="text-sm text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                      >
                        {t(item.name)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

      </Container>
    </footer>
  )
}
