import type { Metadata } from 'next'
import { InlineTOC } from 'fumadocs-ui/components/inline-toc'
import { buttonVariants } from 'fumadocs-ui/components/ui/button'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SITE_PUBLIC_URL } from '@/lib/constants'
import { blog } from '@/lib/source'
import { getMDXComponents } from '@/mdx-components'
import { ShareButton } from './page.client'

export default async function BlogPostPage(props: {
  params: Promise<{ slug: string, locale: string }>
}) {
  const params = await props.params
  const t = await getTranslations('blog')
  const page = blog.getPage([params.slug], params.locale)

  if (!page)
    notFound()

  const Mdx = page.data.body
  const toc = page.data.toc

  return (
    <>
      <div
        className="mx-auto md:mt-12 w-full max-w-fd-container px-4 py-12 md:px-8"
        style={{
          backgroundColor: 'black',
          backgroundImage: [
            'linear-gradient(140deg, hsla(274,94%,54%,0.3), transparent 50%)',
            'linear-gradient(to left top, hsla(260,90%,50%,0.8), transparent 50%)',
            'radial-gradient(circle at 100% 100%, hsla(240,100%,82%,1), hsla(240,40%,40%,1) 17%, hsla(240,40%,40%,0.5) 20%, transparent)',
          ].join(', '),
          backgroundBlendMode: 'difference, difference, normal',
        }}
      >
        <h1 className="mb-2 text-3xl font-bold text-white">
          {page.data.title}
        </h1>
        <p className="mb-4 text-white/80">{page.data.description}</p>
        <Link
          href={`/${params.locale}/blog`}
          className={buttonVariants({ size: 'sm', color: 'secondary' })}
        >
          {t('back')}
        </Link>
      </div>
      <article className="mx-auto flex w-full max-w-fd-container flex-col py-8 lg:flex-row">
        <div className="prose min-w-0 flex-1 p-4">
          <InlineTOC items={toc} />
          <Mdx components={getMDXComponents()} />
        </div>
        <div className="flex flex-col gap-4 border-l p-4 text-sm lg:w-[250px]">
          <div>
            <p className="mb-1 text-fd-muted-foreground">{t('writtenBy')}</p>
            <p className="font-medium">{page.data.author}</p>
          </div>
          <div>
            <p className="mb-1 text-sm text-fd-muted-foreground">{t('at')}</p>
            <p className="font-medium">
              {new Date(page.data.date ?? page.path).toDateString()}
            </p>
          </div>
          {page.data.extensionVersion && (
            <div>
              <p className="mb-1 text-sm text-fd-muted-foreground">{t('extensionVersion')}</p>
              <p className="font-medium">{page.data.extensionVersion}</p>
            </div>
          )}
          <ShareButton url={page.url} />
        </div>
      </article>
    </>
  )
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string, locale: string }>
}): Promise<Metadata> {
  const params = await props.params
  const page = blog.getPage([params.slug], params.locale)

  if (!page)
    notFound()

  const pageUrl = `${SITE_PUBLIC_URL}/${page.url}`
  const pageTitle = page.data.title
  const pageDescription = page.data.description ?? 'Read Frog - Browser Extension for Translation'
  const author = page.data.author
  const date = page.data.date

  return {
    title: pageTitle,
    description: pageDescription,
    openGraph: {
      type: 'article',
      title: pageTitle,
      description: pageDescription,
      url: pageUrl,
      publishedTime: date?.toString(),
      authors: [author],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
    },
  }
}

export function generateStaticParams(): { slug: string, locale: string }[] {
  return blog.generateParams().map(({ slug, lang }) => ({
    slug: slug[0] ?? '',
    locale: lang,
  }))
}
