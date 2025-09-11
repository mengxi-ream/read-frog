import { deepmerge } from 'deepmerge-ts'

export function migrate(oldConfig: any): any {
  return deepmerge(oldConfig, {
    translate: {
      page: {
        autoTranslatePatterns: ['news.ycombinator.com'],
      },
    },
  })
}
