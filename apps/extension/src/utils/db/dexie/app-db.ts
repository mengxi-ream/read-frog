import type { EntityTable } from 'dexie'
import { upperCamelCase } from 'case-anything'
import Dexie from 'dexie'
import { APP_NAME } from '@/utils/constants/app'
import BatchRequestRecord from './tables/batch-request-record'
import TranslationCache from './tables/translation-cache'

export default class AppDB extends Dexie {
  translationCache!: EntityTable<
    TranslationCache,
    'key'
  >

  batchRequestRecord!: EntityTable<
    BatchRequestRecord,
    'key'
  >

  constructor() {
    super(`${upperCamelCase(APP_NAME)}DB`)
    this.version(1).stores({
      translationCache: `
        key,
        translation,
        createdAt`,
    })
    this.version(2).stores({
      translationCache: `
        key,
        translation,
        createdAt`,
      batchRequestRecord: `
        key,
        createdAt,
        originalRequestCount,
        provider,
        model`,
    })
    this.translationCache.mapToClass(TranslationCache)
    this.batchRequestRecord.mapToClass(BatchRequestRecord)
  }
}
