import {
  defineCollections,
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
} from 'fumadocs-mdx/config'
import { z } from 'zod'

// You can customise Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.vercel.app/docs/mdx/collections#define-docs
export const docs = defineDocs({
  docs: {
    schema: frontmatterSchema,
  },
  meta: {
    schema: metaSchema,
    files: ['**/meta.{json,yaml}', '**/meta.*.{json,yaml}'],
  },
})

export const blog = defineCollections({
  type: 'doc',
  dir: 'content/blog',
  schema: frontmatterSchema.extend({
    author: z.string(),
    date: z.date(),
    extensionVersion: z.string().optional(),
  }),
})

export default defineConfig({
  mdxOptions: {
    // MDX options
  },
})
