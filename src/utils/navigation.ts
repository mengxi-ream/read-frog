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

/** The tabs of the custom action editor, in display order. */
export const CUSTOM_ACTION_EDITOR_TABS = ["config", "notebase"] as const

export type CustomActionEditorTab = (typeof CUSTOM_ACTION_EDITOR_TABS)[number]

/** Names the custom action the editor should open. */
export const CUSTOM_ACTION_ID_QUERY_PARAM = "actionId"

/** Names the editor tab to show once the action is open. */
export const CUSTOM_ACTION_TAB_QUERY_PARAM = "tab"

/** Opens the "add action" dialog. */
export const CUSTOM_ACTION_ADD_QUERY_PARAM = "addAction"

/** The `id` on the Layout heading in the Config tab, so `?section=` can reach it. */
export const CUSTOM_ACTION_LAYOUT_SECTION_ID = "custom-actions-layout"

/** The `id` on the Notebase tab trigger, so `?section=` can reach it. */
export const CUSTOM_ACTION_NOTEBASE_SECTION_ID = "custom-actions-notebase"

export interface CustomActionOptionsRouteOptions {
  /** Left out, the editor opens on its first tab. */
  tab?: CustomActionEditorTab
  /**
   * Prefix the route with `/options.html#`, for callers that build the extension URL themselves
   * instead of going through `openOptionsPage`.
   */
  full?: boolean
}

/** Route to the custom action editor with one action selected, optionally on a given tab. */
export function buildCustomActionOptionsRoute(
  actionId: string,
  options?: CustomActionOptionsRouteOptions & { full?: false },
): `/${string}`
export function buildCustomActionOptionsRoute(
  actionId: string,
  options: CustomActionOptionsRouteOptions & { full: true },
): `/options.html#/${string}`
export function buildCustomActionOptionsRoute(
  actionId: string,
  options?: CustomActionOptionsRouteOptions,
): `/${string}` {
  // encodeURIComponent rather than URLSearchParams: existing links spell a space `%20`, not `+`.
  const id = encodeURIComponent(actionId)
  let route: `/${string}` = `/custom-actions?${CUSTOM_ACTION_ID_QUERY_PARAM}=${id}`
  if (options?.tab) {
    route = `${route}&${CUSTOM_ACTION_TAB_QUERY_PARAM}=${options.tab}`
  }
  return options?.full ? `/options.html#${route}` : route
}

function parseCustomActionEditorTab(value: string | null): CustomActionEditorTab | null {
  const tab = value?.trim()
  return CUSTOM_ACTION_EDITOR_TABS.find((item) => item === tab) ?? null
}

export interface CustomActionDeepLink {
  actionId: string | null
  /** Null when the link names no tab, or one this version does not have. */
  tab: CustomActionEditorTab | null
  /** `search` with the custom action params removed: `""` or `?…`. */
  remainingSearch: string
}

/**
 * Reads the custom action params out of `search` and strips them. Returns null when there are
 * none, so running it again on `remainingSearch` is a no-op: a link applies once, not per render.
 */
export function consumeCustomActionDeepLink(search: string): CustomActionDeepLink | null {
  const params = new URLSearchParams(search)
  const keys = [
    CUSTOM_ACTION_ID_QUERY_PARAM,
    CUSTOM_ACTION_TAB_QUERY_PARAM,
    CUSTOM_ACTION_ADD_QUERY_PARAM,
  ]
  if (!keys.some((key) => params.has(key))) {
    return null
  }

  const actionId = params.get(CUSTOM_ACTION_ID_QUERY_PARAM)?.trim() || null
  const tab = parseCustomActionEditorTab(params.get(CUSTOM_ACTION_TAB_QUERY_PARAM))
  for (const key of keys) {
    params.delete(key)
  }
  const remaining = params.toString()
  return { actionId, tab, remainingSearch: remaining ? `?${remaining}` : "" }
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
