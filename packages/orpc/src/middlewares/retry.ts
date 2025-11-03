import { os } from '@orpc/server'

export function retry(options: { times: number }) {
  /**
   * Best practices for dedupe-middlewares
   * {@link https://orpc.unnoq.com/docs/best-practices/dedupe-middleware}
   */
  return os
    .$context<{ canRetry?: boolean }>()
    .middleware(({ context, next }) => {
      const canRetry = context.canRetry ?? true

      if (!canRetry) {
        return next()
      }

      let times = 0
      while (true) {
        try {
          return next({
            context: {
              canRetry: false,
            },
          })
        }
        catch (e) {
          if (times >= options.times) {
            throw e
          }

          times++
        }
      }
    })
}
