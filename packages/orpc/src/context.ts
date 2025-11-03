import { auth } from '@repo/auth'
import { database } from '@repo/db'

interface CreateContextOptions {
  headers: Headers
}

export async function createORPCContext(opts: CreateContextOptions) {
  const headers = opts.headers
  const source = headers.get('x-trpc-source') ?? 'unknown'
  const session = await auth.api.getSession({
    headers,
  })

  // eslint-disable-next-line no-console
  console.log('[oRPC] Request from', source, 'by', session?.user.email)

  return {
    database,
    session,
    ...opts,
  }
}
