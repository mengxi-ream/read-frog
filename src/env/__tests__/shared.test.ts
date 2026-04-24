import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  createExtensionClientEnvSchema,
  LOCAL_EXTENSION_ENV_DEFAULTS,
  PRODUCTION_EXTENSION_ENV_DEFAULTS,
  resolveExtensionEnv,
} from "../shared"

const PRODUCTION_REQUIRED_ENV = {
  WXT_GOOGLE_CLIENT_ID: "test-google-client-id",
  WXT_POSTHOG_HOST: "https://us.i.posthog.com",
  WXT_POSTHOG_API_KEY: "phc_test",
} as const

function parseResolvedExtensionEnv(
  rawEnv: Record<string, string | boolean | undefined>,
  isProd = false,
  skipRequiredProductionEnv = false,
) {
  return z.object(createExtensionClientEnvSchema(isProd, skipRequiredProductionEnv)).parse(resolveExtensionEnv(rawEnv))
}

describe("extension env resolution", () => {
  it("uses production defaults when local packages are disabled", () => {
    expect(resolveExtensionEnv({})).toEqual(PRODUCTION_EXTENSION_ENV_DEFAULTS)
    expect(resolveExtensionEnv({
      WXT_USE_LOCAL_PACKAGES: "false",
    })).toMatchObject({
      ...PRODUCTION_EXTENSION_ENV_DEFAULTS,
      WXT_USE_LOCAL_PACKAGES: "false",
    })
  })

  it("uses localhost defaults when local packages are enabled", () => {
    expect(resolveExtensionEnv({
      WXT_USE_LOCAL_PACKAGES: "true",
    })).toMatchObject({
      ...LOCAL_EXTENSION_ENV_DEFAULTS,
      WXT_USE_LOCAL_PACKAGES: "true",
    })
  })

  it("lets explicit env vars override the selected defaults", () => {
    expect(resolveExtensionEnv({
      WXT_USE_LOCAL_PACKAGES: "true",
      WXT_API_URL: "https://preview-api.readfrog.app",
      WXT_AUTH_COOKIE_DOMAINS: "preview.readfrog.app",
    })).toMatchObject({
      ...LOCAL_EXTENSION_ENV_DEFAULTS,
      WXT_USE_LOCAL_PACKAGES: "true",
      WXT_API_URL: "https://preview-api.readfrog.app",
      WXT_AUTH_COOKIE_DOMAINS: "preview.readfrog.app",
    })
  })

  it("passes through unrelated env vars untouched", () => {
    expect(resolveExtensionEnv({
      WXT_POSTHOG_API_KEY: "phc_test",
      WXT_POSTHOG_TEST_UUID: "00000000-0000-0000-0000-000000000001",
    })).toMatchObject({
      ...PRODUCTION_EXTENSION_ENV_DEFAULTS,
      WXT_POSTHOG_API_KEY: "phc_test",
      WXT_POSTHOG_TEST_UUID: "00000000-0000-0000-0000-000000000001",
    })
  })
})

describe("extension env parsing", () => {
  it("accepts canonical urls, origins, and cookie domains", () => {
    expect(parseResolvedExtensionEnv({
      WXT_WEBSITE_URL: "https://www.readfrog.app",
      WXT_OFFICIAL_SITE_ORIGINS: "https://readfrog.app,https://www.readfrog.app",
      WXT_AUTH_COOKIE_DOMAINS: "readfrog.app,localhost",
    })).toEqual({
      WXT_API_URL: PRODUCTION_EXTENSION_ENV_DEFAULTS.WXT_API_URL,
      WXT_WEBSITE_URL: "https://www.readfrog.app",
      WXT_OFFICIAL_SITE_ORIGINS: ["https://readfrog.app", "https://www.readfrog.app"],
      WXT_AUTH_COOKIE_DOMAINS: ["readfrog.app", "localhost"],
      WXT_GOOGLE_CLIENT_ID: undefined,
      WXT_POSTHOG_HOST: undefined,
      WXT_POSTHOG_API_KEY: undefined,
      WXT_POSTHOG_TEST_UUID: undefined,
    })
  })

  it("rejects urls with trailing slashes", () => {
    expect(() => parseResolvedExtensionEnv({
      WXT_API_URL: "https://api.readfrog.app/",
    })).toThrowError("must not end with a trailing slash")
  })

  it("rejects origin entries that include a trailing slash or path", () => {
    expect(() => parseResolvedExtensionEnv({
      WXT_OFFICIAL_SITE_ORIGINS: "https://readfrog.app/,https://www.readfrog.app",
    })).toThrowError("must be an origin without a trailing slash or path")

    expect(() => parseResolvedExtensionEnv({
      WXT_OFFICIAL_SITE_ORIGINS: "https://readfrog.app/docs",
    })).toThrowError("must be an origin without a trailing slash or path")
  })

  it("rejects cookie domains with leading dots", () => {
    expect(() => parseResolvedExtensionEnv({
      WXT_AUTH_COOKIE_DOMAINS: ".readfrog.app,localhost",
    })).toThrowError("must not start with '.'")
  })

  it("rejects comma-separated entries with spaces", () => {
    expect(() => parseResolvedExtensionEnv({
      WXT_OFFICIAL_SITE_ORIGINS: "https://readfrog.app, https://www.readfrog.app",
    })).toThrowError("must not include leading or trailing whitespace")
  })

  it("requires Google and PostHog env vars when PROD is true", () => {
    expect(() => parseResolvedExtensionEnv({
      WXT_GOOGLE_CLIENT_ID: "test-google-client-id",
      WXT_POSTHOG_HOST: "https://us.i.posthog.com",
    }, true)).toThrowError("expected string, received undefined")
  })

  it("accepts Google and PostHog env vars when PROD is true", () => {
    expect(parseResolvedExtensionEnv({
      ...PRODUCTION_REQUIRED_ENV,
    }, true)).toEqual({
      WXT_API_URL: PRODUCTION_EXTENSION_ENV_DEFAULTS.WXT_API_URL,
      WXT_WEBSITE_URL: PRODUCTION_EXTENSION_ENV_DEFAULTS.WXT_WEBSITE_URL,
      WXT_OFFICIAL_SITE_ORIGINS: ["https://readfrog.app", "https://www.readfrog.app"],
      WXT_AUTH_COOKIE_DOMAINS: ["readfrog.app"],
      WXT_GOOGLE_CLIENT_ID: PRODUCTION_REQUIRED_ENV.WXT_GOOGLE_CLIENT_ID,
      WXT_POSTHOG_HOST: PRODUCTION_REQUIRED_ENV.WXT_POSTHOG_HOST,
      WXT_POSTHOG_API_KEY: PRODUCTION_REQUIRED_ENV.WXT_POSTHOG_API_KEY,
      WXT_POSTHOG_TEST_UUID: undefined,
    })
  })

  it("lets production parsing skip only the required Google and PostHog env vars", () => {
    expect(parseResolvedExtensionEnv({
      WXT_OFFICIAL_SITE_ORIGINS: "https://readfrog.app,https://www.readfrog.app",
    }, true, true)).toEqual({
      WXT_API_URL: PRODUCTION_EXTENSION_ENV_DEFAULTS.WXT_API_URL,
      WXT_WEBSITE_URL: PRODUCTION_EXTENSION_ENV_DEFAULTS.WXT_WEBSITE_URL,
      WXT_OFFICIAL_SITE_ORIGINS: ["https://readfrog.app", "https://www.readfrog.app"],
      WXT_AUTH_COOKIE_DOMAINS: ["readfrog.app"],
      WXT_GOOGLE_CLIENT_ID: undefined,
      WXT_POSTHOG_HOST: undefined,
      WXT_POSTHOG_API_KEY: undefined,
      WXT_POSTHOG_TEST_UUID: undefined,
    })
  })

  it("parses WXT_USE_LOCAL_PACKAGES strictly with zod stringbool", () => {
    expect(resolveExtensionEnv({
      WXT_USE_LOCAL_PACKAGES: true,
    })).toMatchObject({
      ...LOCAL_EXTENSION_ENV_DEFAULTS,
      WXT_USE_LOCAL_PACKAGES: true,
    })

    expect(() => resolveExtensionEnv({
      WXT_USE_LOCAL_PACKAGES: "yes",
    })).toThrowError()
  })
})
