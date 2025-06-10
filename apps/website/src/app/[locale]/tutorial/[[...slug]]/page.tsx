import { GithubInfo } from 'fumadocs-ui/components/github-info'
import { Step, Steps } from 'fumadocs-ui/components/steps'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page'
import { notFound } from 'next/navigation'
import { source } from '@/lib/source'
import { getMDXComponents } from '@/mdx-components'

export default async function Page(props: {
  params: Promise<{ slug?: string[], locale: string }>
}) {
  const { slug, locale } = await props.params
  const page = source.getPage(slug, locale)
  if (!page)
    notFound()

  const MDXContent = page.data.body

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
            GithubInfo,
            Step,
            Steps,
          })}
        />
      </DocsBody>
    </DocsPage>
  )
}

export async function generateStaticParams() {
  return source.generateParams('slug', 'locale')
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[], locale: string }>
}) {
  const { slug, locale } = await props.params
  const page = source.getPage(slug, locale)
  if (!page)
    notFound()

  return {
    title: page.data.title,
    description: page.data.description,
  }
}
