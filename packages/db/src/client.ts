import process from 'node:process'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/schema/auth'

export function createDb() {
  const sql = postgres(process.env.DATABASE_URL!, {
    prepare: false,
  })

  return drizzle(sql, { schema })
}
