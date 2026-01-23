import type { LangCodeISO6393 } from '@read-frog/definitions'
import type { ServiceInfo, TranslationResult } from './types'
import { atom } from 'jotai'

export const sourceLanguageAtom = atom<LangCodeISO6393>('eng')
export const targetLanguageAtom = atom<LangCodeISO6393>('eng') // Will be initialized by hook

export const inputTextAtom = atom('')

export const selectedServicesAtom = atom<ServiceInfo[]>([])

export const translationResultsAtom = atom<TranslationResult[]>([])
