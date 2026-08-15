/**
 * The page → extension bridge partner sites use to send someone straight to the provider they
 * need to set up, instead of talking them through finding it in the options page.
 *
 * `window.postMessage` is delivered to every listener in the page — the page's own scripts, any
 * third-party script on it, and the content scripts of every other extension installed there. So
 * the protocol carries a provider *type* and nothing else: no keys, no config, and no reply that
 * discloses what is configured. The content script treats each message as untrusted and re-checks
 * origin, shape, and provider type; the worst a forged one can do is open the options page.
 */

/** Origins whose pages may ask the extension to open a provider's config. */
export const PARTNER_BRIDGE_ORIGINS = ["https://www.jalapeno-cloud.ai"] as const

/** Marks a message as coming from a partner page rather than from the extension. */
export const PARTNER_BRIDGE_REQUEST_SOURCE = "read-frog-partner-page"

/** Marks the extension's acknowledgement, so a partner page can tell whether we are installed. */
export const PARTNER_BRIDGE_RESPONSE_SOURCE = "read-frog-partner-ext"

export const PARTNER_BRIDGE_OPEN_PROVIDER_CONFIG = "openProviderConfig"
