import { Entity } from 'dexie'

export default class BatchRequestRecord extends Entity {
  key!: string
  createdAt!: Date
  originalRequestCount!: number
  provider!: string
  model!: string
}
