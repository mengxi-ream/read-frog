import { os } from '@orpc/server'
import { database } from '@repo/db'

export const dbProviderMiddleware = os
  .$context<{ db?: typeof database }>()
  .middleware(async ({ context, next }) => {
    const db = context.db ?? database

    return next({
      context: {
        db,
      },
    })
  })
