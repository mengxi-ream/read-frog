import { Entity } from 'dexie'

export default class AiSegmentationCache extends Entity {
  key!: string // Sha256Hex(jsonContentHash, JSON.stringify(providerConfig))
  result!: string // VTT format result
  createdAt!: Date
}
