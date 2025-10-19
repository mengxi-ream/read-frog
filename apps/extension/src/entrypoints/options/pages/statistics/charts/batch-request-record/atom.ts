import type BatchRequestRecord from '@/utils/db/dexie/tables/batch-request-record'
import { atom } from 'jotai'

export const batchRequestRecordsAtom = atom<BatchRequestRecord[]>([])
