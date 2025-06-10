import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react', '@wxt-dev/i18n/module'],
  vite: () => ({
    plugins: [],
  }),
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: ['storage', 'tabs'],
  },
})
