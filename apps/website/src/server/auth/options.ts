import type { BetterAuthOptions } from 'better-auth'

/**
 * Custom options for Better Auth
 *
 * Docs: https://www.better-auth.com/docs/reference/options
 */
export const betterAuthOptions: BetterAuthOptions = {
  /**
   * The name of the application.
   */
  appName: 'YOUR_APP_NAME',
  /**
   * Base path for Better Auth.
   * @default "/api/auth"
   */
  // basePath: "/api",

  /**
   * Enable email and password authentication
   */
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // TODO: set to be true later
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },

  // .... More options
}
