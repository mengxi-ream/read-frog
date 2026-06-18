import { Entity } from "dexie";
export default class TranslationCache extends Entity {
    key;
    translation;
    createdAt;
}
