export const PROVIDER_SETUP_ERROR_NAME = "ProviderSetupError"

/**
 * A provider that cannot be used as configured: no model selected, or no
 * config for its id. Analytics reads the name to tell a broken setup from an
 * outage, and the name survives the content↔background messaging boundary.
 */
export class ProviderSetupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = PROVIDER_SETUP_ERROR_NAME
  }
}
