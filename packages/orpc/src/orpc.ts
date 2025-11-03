import { os } from '@orpc/server'
import { dbProviderMiddleware } from './middlewares/db'

export const pub = os.use(dbProviderMiddleware)
