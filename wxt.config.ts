import path from 'node:path'
import process from 'node:process'
import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  imports: false,
  modules: ['@wxt-dev/module-react', '@wxt-dev/i18n/module'],
  manifestVersion: 3,
  // WXT top level alias - will be automatically synced to tsconfig.json paths and Vite alias
  alias: process.env.WXT_USE_LOCAL_PACKAGES === 'true'
    ? {
        '@read-frog/definitions': path.resolve(__dirname, '../read-frog-monorepo/packages/definitions/src'),
        '@read-frog/api-contract': path.resolve(__dirname, '../read-frog-monorepo/packages/api-contract/src'),
      }
    : {},
  manifest: ({ mode, browser }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    // Fixed extension ID for development
    ...(mode === 'development' && (browser === 'chrome' || browser === 'edge') && {
      key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw2KhiXO2vySZtPu5pNSbyKhYavh8Be7gXmCZt8aJf6tQ/L3JK0qzL+3JSc/o20td3Jw+B2Dcw+EI93NAZr24xKnTNXQiJpuIuHb8xLXD0Ra/HrTVi4TJIhPdESogoG4uL6CD/F3TxfZJ2trX4Bt9cdAw1RGGeU+xU0g+YFfEka4ZUCpFAmTEw9H3/DU+nCp8yGaJWyiVgCTcFe38GZKEPt0iMJkTw956wz/iiafLx0pNG/RaztG9cAPoQOD2+SMFaeQ+b/G4OG17TYhzb09AhNBl6zSJ3jTKHSwuedCFwCce8Q/EchJfQZv71mjAE97bzwvkDYPCLj31Z5FE8HntMwIDAQAB',
    }),
    permissions: ['storage', 'tabs', 'alarms', 'cookies', 'contextMenus', 'identity'],
    oauth2: {
      client_id: import.meta.env.WXT_GOOGLE_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/drive.appdata'],
    },
    host_permissions:
      mode === 'development'
        ? [
            'http://localhost:*/*', // For local backend (dev:local)
            'https://*.readfrog.app/*', // For prod backend (dev)
            'https://readfrog.app/*', // For prod backend (dev)
            'https://www.googleapis.com/*',
          ]
        : [
            'https://*.readfrog.app/*',
            'https://readfrog.app/*', // Include both www and non-www versions
            'https://www.googleapis.com/*', // Google Drive API
          ],
    // Firefox-specific settings for MV3
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'extension@readfrog.app',
          strict_min_version: '109.0',
        },
      },
    }),
  }),
  dev: {
    server: {
      port: 3333,
    },
  },
})
