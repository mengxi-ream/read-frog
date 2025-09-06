import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'
import { SITE_PUBLIC_URL } from '@/lib/constants'
import { source } from '@/lib/source'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_PUBLIC_URL
  const locales = routing.locales

  const createLocalizedUrl = (path: string = '') => {
    const alternates: Record<string, string> = {}
    for (const locale of locales) {
      alternates[locale] = `${baseUrl}/${locale}${path}`
    }
    return { languages: alternates }
  }

  const createUrl = (path: string = '') => {
    return `${baseUrl}${path}`
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: createUrl(),
      changeFrequency: 'weekly',
      priority: 1,
      alternates: createLocalizedUrl(),
    },
    {
      url: createUrl('/dashboard'),
      changeFrequency: 'monthly',
      priority: 0.9,
      alternates: createLocalizedUrl('/dashboard'),
    },
    {
      url: createUrl('/log-in'),
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: createLocalizedUrl('/log-in'),
    },
    {
      url: createUrl('/tutorial'),
      changeFrequency: 'weekly',
      priority: 0.9,
      alternates: createLocalizedUrl('/tutorial'),
    },
    {
      url: createUrl('/privacy-policy'),
      changeFrequency: 'yearly',
      priority: 0.1,
      alternates: createLocalizedUrl('/privacy-policy'),
    },
    {
      url: createUrl('/terms-of-service'),
      changeFrequency: 'yearly',
      priority: 0.1,
      alternates: createLocalizedUrl('/terms-of-service'),
    },
  ]

  for (let step = 1; step <= 4; step++) {
    staticRoutes.push({
      url: createUrl(`/guide/step-${step}`),
      changeFrequency: 'weekly',
      priority: 0.8,
      alternates: createLocalizedUrl(`/guide/step-${step}`),
    })
  }

  // dynamic tutorial routes
  const dynamicRoutes: MetadataRoute.Sitemap = []

  try {
    const tutorialPages = source.generateParams('slug')
    for (const page of tutorialPages) {
      if (page.slug && Array.isArray(page.slug)) {
        const slug = page.slug.join('/')
        dynamicRoutes.push({
          url: createUrl(`/tutorial/${slug}`),
          changeFrequency: 'weekly',
          priority: 0.7,
          alternates: createLocalizedUrl(`/tutorial/${slug}`),
        })
      }
    }
  }
  catch (error) {
    console.warn('Failed to generate tutorial pages:', error)
  }

  return [...staticRoutes, ...dynamicRoutes]
}
