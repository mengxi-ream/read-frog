import antfu from '@antfu/eslint-config'

export default antfu(
  {
    formatters: {
      css: true,
      html: true,
      markdown: 'prettier',
    },
  },
  {
    ignores: ['apps/**/*', 'packages/**/*', 'node_modules/**/*', 'dist/**/*', '.turbo/**/*'],
  },
)
