import { browser } from "#imports"

export interface OpenOptionsPageOptions {
  route?: `/${string}`
}

/** Names the options section a link wants scrolled into view. */
export const SECTION_QUERY_PARAM = "section"

/** The `id` on the Provider Config item, so `?section=` can scroll to it. */
export const PROVIDER_CONFIG_SECTION_ID = "provider-config"

/** Names the provider Provider Config should open once it is scrolled into view. */
export const PROVIDER_QUERY_PARAM = "provider"

/**
 * Route to Provider Config with one provider already selected — where a "set your API key"
 * prompt should send the user, so the field they need to fill in is already on screen.
 */
export function buildProviderConfigRoute(providerId: string): `/${string}` {
  const params = new URLSearchParams({
    [SECTION_QUERY_PARAM]: PROVIDER_CONFIG_SECTION_ID,
    [PROVIDER_QUERY_PARAM]: providerId,
  })
  return `/api-providers?${params.toString()}`
}

export function getRequestedProviderId(search: string): string | null {
  const providerId = new URLSearchParams(search).get(PROVIDER_QUERY_PARAM)?.trim()
  return providerId ? providerId : null
}

export async function openOptionsPage(options?: OpenOptionsPageOptions) {
  const route = options?.route ?? ""

  try {
    await browser.tabs.create({
      active: true,
      url: browser.runtime.getURL(`/options.html${route ? `#${route}` : ""}`),
    })
    return
  } catch (error) {
    if (!browser.runtime.openOptionsPage) {
      throw error
    }
  }

  await browser.runtime.openOptionsPage()
}
