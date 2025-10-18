import type { EntityTable } from 'dexie'
import { upperCamelCase } from 'case-anything'
import Dexie from 'dexie'
import { APP_NAME } from '@/utils/constants/app'
import BatchRequestTimes from './tables/batch-request-times'
import TranslationCache from './tables/translation-cache'

export default class AppDB extends Dexie {
  translationCache!: EntityTable<
    TranslationCache,
    'key'
  >

  batchRequestTimes!: EntityTable<
    BatchRequestTimes,
    'key'
  >

  constructor() {
    super(`${upperCamelCase(APP_NAME)}DB`)
    this.version(1).stores({
      translationCache: `
        key,
        translation,
        createdAt`,
      batchRequestTimes: `
        key,
        createdAt,
        originalRequestCount,
        provider,
        model`,
    })
    this.translationCache.mapToClass(TranslationCache)
    this.batchRequestTimes.mapToClass(BatchRequestTimes)
  }
}
