import process from "node:process"

const DEVELOPMENT_CHROME_EDGE_KEY = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw2KhiXO2vySZtPu5pNSbyKhYavh8Be7gXmCZt8aJf6tQ/L3JK0qzL+3JSc/o20td3Jw+B2Dcw+EI93NAZr24xKnTNXQiJpuIuHb8xLXD0Ra/HrTVi4TJIhPdESogoG4uL6CD/F3TxfZJ2trX4Bt9cdAw1RGGeU+xU0g+YFfEka4ZUCpFAmTEw9H3/DU+nCp8yGaJWyiVgCTcFe38GZKEPt0iMJkTw956wz/iiafLx0pNG/RaztG9cAPoQOD2+SMFaeQ+b/G4OG17TYhzb09AhNBl6zSJ3jTKHSwuedCFwCce8Q/EchJfQZv71mjAE97bzwvkDYPCLj31Z5FE8HntMwIDAQAB"

interface CreateExtensionManifestOptions {
  browser: string
  mode: string
  isFirefoxAndroidBuild?: boolean
}

export function isFirefoxAndroidBuildTargetEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.WXT_FIREFOX_ANDROID === "true"
}

export function getZipRequiredEnvVars(isFirefoxAndroidBuild = isFirefoxAndroidBuildTargetEnabled()): string[] {
  return [
    ...(!isFirefoxAndroidBuild ? ["WXT_GOOGLE_CLIENT_ID"] : []),
    "WXT_POSTHOG_API_KEY",
    "WXT_POSTHOG_HOST",
  ]
}

function getManifestPermissions(
  browser: string,
  isFirefoxAndroidBuild: boolean,
): string[] {
  return [
    "storage",
    "tabs",
    "alarms",
    "cookies",
    ...(!isFirefoxAndroidBuild ? ["contextMenus", "identity"] : []),
    "scripting",
    "webNavigation",
    ...(browser !== "firefox" ? ["offscreen"] : []),
  ]
}

export function createExtensionManifest({
  browser,
  mode,
  isFirefoxAndroidBuild = browser === "firefox" && isFirefoxAndroidBuildTargetEnabled(),
}: CreateExtensionManifestOptions) {
  return {
    name: "__MSG_extName__",
    description: "__MSG_extDescription__",
    default_locale: "en",
    ...(mode === "development" && (browser === "chrome" || browser === "edge") && {
      key: DEVELOPMENT_CHROME_EDGE_KEY,
    }),
    permissions: getManifestPermissions(browser, isFirefoxAndroidBuild),
    host_permissions: [
      "*://*/*", // Required for scripting.executeScript in any frame
    ],
    // Allow images/SVGs referenced by content-script UI <img> tags to be loaded from
    // moz-extension:// URLs on regular pages. Firefox enforces this more strictly.
    web_accessible_resources: [
      {
        resources: ["assets/*.png", "assets/*.svg", "assets/*.webp"],
        matches: ["*://*/*", "file:///*"],
      },
    ],
    ...(browser === "firefox" && {
      // Override default CSP to exclude `upgrade-insecure-requests` (Firefox MV3 default),
      // which would upgrade custom provider HTTP URLs (e.g. LAN) to HTTPS.
      content_security_policy: {
        extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
      },
      browser_specific_settings: {
        gecko: {
          id: "{bd311a81-4530-4fcc-9178-74006155461b}",
          strict_min_version: "112.0",
          data_collection_permissions: {
            required: ["none"],
            optional: ["technicalAndInteraction"],
          },
        },
        ...(isFirefoxAndroidBuild ? { gecko_android: {} } : {}),
      },
    }),
  }
}
