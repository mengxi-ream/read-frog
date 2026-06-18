import { Entity } from "dexie";
export default class BatchRequestRecord extends Entity {
    key;
    createdAt;
    originalRequestCount;
    provider;
    model;
}
