import { LANG_CODE_ISO6393_OPTIONS } from '@repo/definitions'
import { pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const langCodeISO6393Enum = pgEnum('lang_code_iso_639_3', LANG_CODE_ISO6393_OPTIONS)

export const vocabulary = pgTable('vocabulary', {
  id: text('id').primaryKey(),

  originalText: text('original_text').notNull(),
  translation: text('translation').notNull(),
  sourceLanguageISO6393: langCodeISO6393Enum('source_language_iso_639_3').notNull(),
  targetLanguageISO6393: langCodeISO6393Enum('target_language_iso_639_3').notNull(),

  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),

  createdAt: timestamp('created_at')
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => new Date())
    .notNull(),
})
