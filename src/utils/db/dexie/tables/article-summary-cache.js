import { Entity } from "dexie";
export default class ArticleSummaryCache extends Entity {
    key; // Sha256Hex(textContentHash, JSON.stringify(providerConfig))
    summary;
    createdAt;
}
