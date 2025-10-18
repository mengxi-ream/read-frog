import { Entity } from 'dexie'

export default class BatchRequestTimes extends Entity {
  key!: string
  createdAt!: Date
  originalRequestCount!: number
  provider!: string
  model!: string
}
