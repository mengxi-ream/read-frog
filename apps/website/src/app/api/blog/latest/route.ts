import type { NextRequest } from 'next/server'
import type { Locale } from '@/i18n/routing'
import { NextResponse } from 'next/server'
import { locales } from '@/i18n/routing'
import { blog } from '@/lib/source'

/**
 * GET /api/blog/latest
 * Returns the latest blog post information for a given locale
 *
 * Query params:
 * - locale: string (default: 'en') - The locale to fetch the latest post for
 *
 * Response:
 * - 200: { date: string (ISO), title: string, description: string, url: string, extensionVersion: string | null } | null
 * - 400: { error: string } - Invalid locale parameter
 */
export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const locale = searchParams.get('locale') || 'en'

  // Validate locale (basic validation)
  if (!locales.includes(locale as Locale)) {
    return NextResponse.json(
      { error: 'Invalid locale parameter' },
      { status: 400 },
    )
  }

  try {
    const posts = [...blog.getPages(locale)].sort(
      (a, b) =>
        new Date(b.data.date ?? b.path).getTime()
          - new Date(a.data.date ?? a.path).getTime(),
    )

    if (posts.length === 0) {
      return NextResponse.json(null)
    }

    const latestPost = posts[0]
    if (!latestPost) {
      return NextResponse.json(null)
    }

    const date = new Date(latestPost.data.date ?? latestPost.path)

    return NextResponse.json({
      date: date.toISOString(),
      title: latestPost.data.title,
      description: latestPost.data.description,
      url: `/blog/${latestPost.slugs.join('/')}`,
      extensionVersion: latestPost.data.extensionVersion ?? null,
    })
  }
  catch (error) {
    console.error('Error fetching latest blog post:', error)
    return NextResponse.json(
      { error: 'Failed to fetch latest blog post' },
      { status: 500 },
    )
  }
}
