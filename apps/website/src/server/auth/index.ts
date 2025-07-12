import process from 'node:process'
import { authSchema, createDb } from '@repo/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { openAPI } from 'better-auth/plugins'
import { betterAuthOptions } from './options'

export const auth = betterAuth({
  ...betterAuthOptions,
  database: drizzleAdapter(createDb(), {
    provider: 'pg',
    schema: authSchema,
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  plugins: [openAPI()],
})
