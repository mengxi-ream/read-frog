import * as authSchema from './schema/auth'
import * as testSchema from './schema/test'
import * as vocabularySchema from './schema/vocabulary'

export const schema = { ...authSchema, ...testSchema, ...vocabularySchema }
