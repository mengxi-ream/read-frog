import type { BaseLayoutProps, LinkItemType } from 'fumadocs-ui/layouts/shared'
import type { Locale } from '@/i18n/routing'
import { GithubInfo } from 'fumadocs-ui/components/github-info'
import Image from 'next/image'
import { UserAccount } from '@/components/user-account'
import { env } from '@/env'
import { APP_NAME_LOCALE, NAV_ITEMS_LOCALE } from '@/lib/constants'
import { i18n } from '@/lib/i18n'

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export function baseOptions(locale: Locale): BaseLayoutProps {
  return {
    githubUrl: 'https://github.com/mengxi-ream/read-frog',
    i18n,
    nav: {
      title: (
        <>
          <Image src="/logo.png" alt="Logo" className="size-6" width={24} height={24} />
          {APP_NAME_LOCALE[locale]}
        </>
      ),
    },
  }
}

export function homeLinks(locale: Locale): LinkItemType[] {
  return [
    {
      text: NAV_ITEMS_LOCALE.tutorial[locale],
      url: `/${locale}/tutorial`,
      active: 'nested-url',
    },
    {
      text: NAV_ITEMS_LOCALE.blog[locale],
      url: `/${locale}/blog`,
      active: 'nested-url',
    },
    {
      text: NAV_ITEMS_LOCALE.changelog[locale],
      url: `/${locale}/changelog`,
      active: 'nested-url',
    },
    {
      type: 'custom',
      children: <UserAccount />,
      secondary: true,
    },
  ]
}

export const docsLinks: LinkItemType[] = [
  {
    type: 'custom',
    children: (
      <GithubInfo owner="mengxi-ream" repo="read-frog" className="lg:-mx-2" token={env.PUBLIC_REPO_GITHUB_TOKEN} />
    ),
  },
]
