import z from 'zod'
import { retry } from '../middlewares/retry'
import { pub } from '../orpc'

export const echoHandler = pub
  .use(retry({ times: 3 }))
  .route({
    method: 'GET',
    path: '/planets',
    summary: 'List all planets',
    tags: ['Planets'],
  })
  .input(
    z.object({
      message: z.string(),
    }),
  )
  .output(
    z.object({
      echoedMessage: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    return {
      echoedMessage: `Server received: ${input.message}`,
    }
  })
