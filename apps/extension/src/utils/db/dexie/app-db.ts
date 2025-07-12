import type { EntityTable } from 'dexie'
import { upperCamelCase } from 'case-anything'
import Dexie from 'dexie'
import { APP_NAME } from '@/utils/constants/app'
import TranslationCache from './tables/translation-cache'

export default class AppDB extends Dexie {
  translationCache!: EntityTable<
    TranslationCache,
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
    this.translationCache.mapToClass(TranslationCache)
  }
}
