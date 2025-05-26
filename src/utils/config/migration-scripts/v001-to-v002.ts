import deepmerge from 'deepmerge'

export function migrate(oldConfig: any): any {
  return deepmerge(oldConfig, {
    pageTranslate: {
      range: 'mainContent',
    },
  })
}
