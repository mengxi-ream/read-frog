import { TRUSTED_ORIGINS } from '@repo/definitions'
import { authSchema, db } from '@repo/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { openAPI } from 'better-auth/plugins'
import { env } from './env'
import { betterAuthOptions } from './options'

export function getTrustedOrigins() {
  if (env.NODE_ENV === 'development') {
    return [...TRUSTED_ORIGINS, 'chrome-extension://*', 'extension://*']
  }
  return TRUSTED_ORIGINS
}

export const auth = betterAuth({
  ...betterAuthOptions,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),
  trustedOrigins: getTrustedOrigins(),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  plugins: [openAPI()],
})
