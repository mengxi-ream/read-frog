import * as authSchema from './schema/auth'
import * as testSchema from './schema/test'

export const schema = { ...authSchema, ...testSchema }
