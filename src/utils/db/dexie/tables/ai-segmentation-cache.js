import { Entity } from "dexie";
export default class AiSegmentationCache extends Entity {
    key; // Sha256Hex(jsonContentHash, JSON.stringify(providerConfig))
    result; // VTT format result
    createdAt;
}
