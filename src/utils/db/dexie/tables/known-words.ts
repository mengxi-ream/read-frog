import { Entity } from "dexie"

export default class KnownWord extends Entity {
  word!: string

  createdAt!: Date
}
