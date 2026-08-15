import type { APIProviderTypes } from "@/types/config/provider"
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
 * Names the provider *type* Provider Config should open, for links written by someone who cannot
 * know the id — an external site pointing at "your OpenAI provider". The first provider of that
 * type wins, and one is created when there is none.
 */
export const PROVIDER_TYPE_QUERY_PARAM = "providerType"

/** Names the field Provider Config should draw attention to once the provider is open. */
export const HIGHLIGHT_QUERY_PARAM = "highlight"

export const API_KEY_HIGHLIGHT_VALUE = "apiKey"

export interface ProviderConfigRouteOptions {
  /** Flash a ring around the API key input — for links whose whole point is that field. */
  highlightApiKey?: boolean
}

function buildProviderConfigRouteFrom(
  params: URLSearchParams,
  options?: ProviderConfigRouteOptions,
): `/${string}` {
  if (options?.highlightApiKey) {
    params.set(HIGHLIGHT_QUERY_PARAM, API_KEY_HIGHLIGHT_VALUE)
  }
  return `/api-providers?${params.toString()}`
}

/**
 * Route to Provider Config with one provider already selected — where a "set your API key"
 * prompt should send the user, so the field they need to fill in is already on screen.
 */
export function buildProviderConfigRoute(
  providerId: string,
  options?: ProviderConfigRouteOptions,
): `/${string}` {
  const params = new URLSearchParams({
    [SECTION_QUERY_PARAM]: PROVIDER_CONFIG_SECTION_ID,
    [PROVIDER_QUERY_PARAM]: providerId,
  })
  return buildProviderConfigRouteFrom(params, options)
}

/** The same destination addressed by provider type rather than by id. */
export function buildProviderTypeConfigRoute(
  providerType: APIProviderTypes,
  options?: ProviderConfigRouteOptions,
): `/${string}` {
  const params = new URLSearchParams({
    [SECTION_QUERY_PARAM]: PROVIDER_CONFIG_SECTION_ID,
    [PROVIDER_TYPE_QUERY_PARAM]: providerType,
  })
  return buildProviderConfigRouteFrom(params, options)
}

export function getRequestedProviderId(search: string): string | null {
  const providerId = new URLSearchParams(search).get(PROVIDER_QUERY_PARAM)?.trim()
  return providerId ? providerId : null
}

/**
 * Left as a plain string for the caller to validate against `isAPIProvider`: this module is
 * imported by the background and by content scripts, and only the reader needs the provider table.
 */
export function getRequestedProviderType(search: string): string | null {
  const providerType = new URLSearchParams(search).get(PROVIDER_TYPE_QUERY_PARAM)?.trim()
  return providerType ? providerType : null
}

export function shouldHighlightApiKey(search: string): boolean {
  return new URLSearchParams(search).get(HIGHLIGHT_QUERY_PARAM) === API_KEY_HIGHLIGHT_VALUE
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
