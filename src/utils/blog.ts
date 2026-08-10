import type { LatestBlogPost } from "@read-frog/definitions"
import {
  bilibiliVideoUrlSchema,
  getBilibiliVideoIdFromUrl,
  latestBlogResponseSchema,
} from "@read-frog/definitions"
import { browser, storage } from "#imports"
import { logger } from "./logger"
import { sendMessage } from "./message"

const LAST_VIEWED_BLOG_DATE_KEY = "lastViewedBlogDate"
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const BILIBILI_EMBED_HOSTNAME = "player.bilibili.com"
const DEFAULT_BLOG_LOCALE = "en"

export type BlogLocale = "en" | "zh" | "zh-TW" | "ko" | "vi" | "ru" | "tr" | "ja" | "es"

const BLOG_LOCALE_BY_PRIMARY_LANGUAGE: Partial<Record<string, BlogLocale>> = {
  en: "en",
  es: "es",
  ja: "ja",
  ko: "ko",
  ru: "ru",
  tr: "tr",
  vi: "vi",
}

// Wire schema and bilibili helpers live in @read-frog/definitions, shared with
// the www route that serves /api/blog/latest.
export type { LatestBlogPost } from "@read-frog/definitions"

/**
 * Saves the last viewed blog date to Chrome storage
 */
export async function saveLastViewedBlogDate(date: Date): Promise<void> {
  await storage.setItem(`local:${LAST_VIEWED_BLOG_DATE_KEY}`, date.toISOString())
}

/**
 * Retrieves the last viewed blog date from Chrome storage
 */
export async function getLastViewedBlogDate(): Promise<Date | null> {
  const dateStr = await storage.getItem<string>(`local:${LAST_VIEWED_BLOG_DATE_KEY}`)
  return dateStr ? new Date(dateStr) : null
}

/**
 * Checks if there's a new blog post by comparing last viewed date with latest blog date
 * @param latestViewedDate - The last date the user viewed the blog
 * @param latestDate - The date of the latest blog post
 */
export function hasNewBlogPost(latestViewedDate: Date | null, latestDate: Date | null): boolean {
  if (!latestDate) return false

  if (!latestViewedDate) return true
  return latestDate > latestViewedDate
}

export function extractBilibiliVideoId(url: string): string | null {
  const result = bilibiliVideoUrlSchema.safeParse(url)
  if (!result.success) {
    return null
  }

  return getBilibiliVideoIdFromUrl(result.data)
}

export function buildBilibiliEmbedUrl(url: string): string | null {
  const videoId = extractBilibiliVideoId(url)
  if (!videoId) {
    return null
  }

  const embedUrl = new URL(`https://${BILIBILI_EMBED_HOSTNAME}/player.html`)
  embedUrl.searchParams.set("bvid", videoId)
  embedUrl.searchParams.set("autoplay", "1")
  embedUrl.searchParams.set("muted", "1")
  embedUrl.searchParams.set("danmaku", "0")
  return embedUrl.toString()
}

export function resolveBlogLocale(uiLocale?: string | null): BlogLocale {
  const normalizedLocale = uiLocale?.trim().replaceAll("_", "-").toLowerCase()
  if (!normalizedLocale) {
    return DEFAULT_BLOG_LOCALE
  }

  if (normalizedLocale.startsWith("zh")) {
    return normalizedLocale.includes("hant") ||
      normalizedLocale === "zh-tw" ||
      normalizedLocale === "zh-hk" ||
      normalizedLocale === "zh-mo"
      ? "zh-TW"
      : "zh"
  }

  return (
    BLOG_LOCALE_BY_PRIMARY_LANGUAGE[normalizedLocale.split("-")[0] ?? ""] ?? DEFAULT_BLOG_LOCALE
  )
}

export function getBlogLocaleFromUILanguage(): BlogLocale {
  const uiLocale =
    browser.i18n.getUILanguage?.() ||
    browser.i18n.getMessage?.("@@ui_locale") ||
    globalThis.navigator?.language ||
    DEFAULT_BLOG_LOCALE

  return resolveBlogLocale(uiLocale)
}

/**
 * Fetches the latest blog post from the Read Frog blog API.
 * Uses background fetch with optional 1-day cache.
 *
 * @param apiUrl - The URL of the blog API endpoint (default: production URL)
 * @param locale - The locale to fetch the latest post for (default: 'en')
 * @param extensionVersion - The current extension version to filter compatible posts
 * @param useCache - Whether to use cache (default: true)
 * @returns Promise resolving to the latest blog post metadata, or null if no posts found
 *
 * @example
 * ```ts
 * const latestPost = await getLatestBlogDate('http://localhost:8888/api/blog/latest', 'en', '1.10.0')
 * console.log(latestPost)
 * // {
 * //   date: Date,
 * //   title: 'Spring update',
 * //   description: 'New subtitle features shipped.',
 * //   url: '/blog/post-slug',
 * //   urlOverride: 'https://www.readfrog.app',
 * //   imageUrl: 'https://www.readfrog.app/blog/landing-page-refresh/cover-en.png',
 * //   videoUrl: 'https://www.bilibili.com/video/BV...',
 * //   extensionVersion: '1.11.0',
 * // }
 *
 * // Without cache
 * const freshPost = await getLatestBlogDate('http://localhost:8888/api/blog/latest', 'en', '1.10.0', false)
 * ```
 */
export async function getLatestBlogDate(
  apiUrl: string = "https://readfrog.app/api/blog/latest",
  locale: string = "en",
  extensionVersion?: string,
  useCache: boolean = true,
): Promise<LatestBlogPost | null> {
  try {
    const url = new URL(apiUrl)
    url.searchParams.set("locale", locale)
    if (extensionVersion) {
      url.searchParams.set("extensionVersion", extensionVersion)
    }

    const response = await sendMessage("backgroundFetch", {
      url: url.toString(),
      method: "GET",
      cacheConfig: useCache
        ? {
            enabled: true,
            groupKey: "blog-fetch",
            ttl: ONE_DAY_MS,
          }
        : undefined,
    })

    if (response.status !== 200) {
      throw new Error(`Failed to fetch blog: ${response.status}`)
    }

    return latestBlogResponseSchema.parse(JSON.parse(response.body))
  } catch (error) {
    logger.error("Error fetching latest blog post:", error)
    return null
  }
}
