import type { BetterAuthOptions } from 'better-auth'
import { APP_NAME } from '@repo/constants'
import { env } from './env'

/**
 * Custom options for Better Auth
 *
 * Docs: https://www.better-auth.com/docs/reference/options
 */
export const betterAuthOptions: BetterAuthOptions = {
  /**
   * The name of the application.
   */
  appName: APP_NAME,
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
  socialProviders: {
    google: {
      prompt: 'select_account',
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  // .... More options
}
