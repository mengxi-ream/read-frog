import { Entity } from "dexie"

export default class WordGlossCache extends Entity {
  /** `${targetLangCode}:${normalizedWord}` */
  key!: string

  gloss!: string

  createdAt!: Date
}
