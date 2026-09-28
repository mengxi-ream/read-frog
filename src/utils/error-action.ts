import { env } from "@/env"
import { i18n } from "@/utils/i18n"

/**
 * A call to action carried alongside an error — "Upgrade", "Log in".
 * Described as data rather than a callback so the layer that raises the error
 * stays free of UI concerns, the action survives the trip across a message
 * port, and tests can assert on it without comparing functions. Whatever shows
 * the error (a toast, an inline alert) turns it into a button.
 */
export interface ErrorAction {
  /** Already localized. */
  label: string
  /** Absolute URL, opened through the background worker on click. */
  url: string
}

/**
 * The single place that knows where a denial sends the user and what its
 * button says. Every wall — subtitles pre-flights, server error codes, Built-in
 * AI quota — builds its call to action from here, so moving a landing page is
 * one edit rather than a grep across features.
 */

function websiteUrl(path: string): string {
  return new URL(path, env.WXT_WEBSITE_URL).toString()
}

export function pricingUrl(): string {
  return websiteUrl("/pricing")
}

/** Billing lives in the app's settings dialog, not on the marketing page. */
export function billingUrl(): string {
  return websiteUrl("/home")
}

export function logInUrl(): string {
  return websiteUrl("/log-in")
}

export function upgradeAction(): ErrorAction {
  return { label: i18n.t("action.upgrade"), url: pricingUrl() }
}

/**
 * Dunning, not cancellation: they already pay and the card just failed, so
 * sending them to pricing would invite an existing subscriber to subscribe
 * again — and a button reading "Upgrade" would say the wrong thing to someone
 * who already did.
 */
export function billingAction(): ErrorAction {
  return { label: i18n.t("action.updatePayment"), url: billingUrl() }
}

export function logInAction(): ErrorAction {
  return { label: i18n.t("account.login"), url: logInUrl() }
}
