import type { RouterClient } from '@orpc/server'
import { echoHandler } from './router/getting'

export const router = {
  echoHandler,
}

export type ORPCRouterClient = RouterClient<typeof router>
