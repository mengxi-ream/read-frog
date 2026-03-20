import path from "node:path"
import process from "node:process"
import { defineConfig } from "wxt"
import {
  createExtensionManifest,
  getZipRequiredEnvVars,
  isFirefoxAndroidBuildTargetEnabled,
} from "./wxt.manifest"

const WXT_API_KEY_PATTERN = /^WXT_.*API_KEY/
const ALLOWED_BUNDLED_API_KEYS = new Set([
  "WXT_POSTHOG_API_KEY",
])

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  imports: false,
  modules: ["@wxt-dev/module-react", "@wxt-dev/i18n/module"],
  manifestVersion: 3,
  // WXT top level alias - will be automatically synced to tsconfig.json paths and Vite alias
  alias: process.env.WXT_USE_LOCAL_PACKAGES === "true"
    ? {
        "@read-frog/definitions": path.resolve(__dirname, "../read-frog-monorepo/packages/definitions/src"),
        "@read-frog/api-contract": path.resolve(__dirname, "../read-frog-monorepo/packages/api-contract/src"),
      }
    : {},
  manifest: ({ mode, browser }) => createExtensionManifest({
    mode,
    browser,
    isFirefoxAndroidBuild: browser === "firefox" && isFirefoxAndroidBuildTargetEnabled(),
  }),
  zip: {
    includeSources: [".env.production"],
    excludeSources: ["docs/**/*", "assets/**/*", "repos/**/*"],
  },
  dev: {
    server: {
      port: 3333,
    },
  },
  vite: configEnv => ({
    plugins: configEnv.mode === "production"
      ? [
          {
            name: "check-api-key-env",
            buildStart() {
              const apiKeyVars = Object.keys(process.env)
                .filter(key => WXT_API_KEY_PATTERN.test(key))
                .filter(key => !ALLOWED_BUNDLED_API_KEYS.has(key))

              if (apiKeyVars.length > 0) {
                throw new Error(
                  `\n\nFound WXT_*_API_KEY environment variables that may be bundled:\n`
                  + `${apiKeyVars.map(k => `   - ${k}`).join("\n")}\n\n`
                  + `Please unset these variables before building for production.\n`,
                )
              }

              // Check required env vars only for zip builds
              if (process.env.WXT_ZIP_MODE) {
                const requiredEnvVars = getZipRequiredEnvVars()
                const missing = requiredEnvVars.filter(key => !process.env[key])

                if (missing.length > 0) {
                  throw new Error(
                    `\n\nMissing required environment variables for zip:\n`
                    + `${missing.map(k => `   - ${k}`).join("\n")}\n\n`
                    + `Set them in .env.production or your environment.\n`,
                  )
                }
              }
            },
          },
        ]
      : [],
  }),
})
