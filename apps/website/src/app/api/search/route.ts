import { createTokenizer } from '@orama/tokenizers/mandarin'
import { createFromSource } from 'fumadocs-core/search/server'
import { source } from '@/lib/source'

export const { GET } = createFromSource(source, {
  localeMap: {
    // you can customise search configs for specific locales, like:
    // [locale]: Orama options

    zh: {
      components: {
        tokenizer: createTokenizer(),
      },
      search: {
        threshold: 0,
        tolerance: 0,
      },
    },
  },
})
