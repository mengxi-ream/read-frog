import deepmerge from 'deepmerge'

export function migrate(oldConfig: any): any {
  const {
    manualTranslate,
    pageTranslate,
    ...restConfig
  } = oldConfig

  if (pageTranslate.range === 'mainContent') {
    pageTranslate.range = 'main'
  }

  return deepmerge(restConfig, {
    translate: {
      provider: 'microsoft',
      node: manualTranslate,
      page: pageTranslate,
    },
  })
}
