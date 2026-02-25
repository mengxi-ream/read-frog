import { Entity } from "dexie"

export default class ArticleSummaryCache extends Entity {
  key!: string // Sha256Hex(textContentHash, JSON.stringify(providerConfig))
  summary!: string
  createdAt!: Date
}
