import { atom } from "jotai";
import { storage } from "#imports";
import { LAST_SYNCED_CONFIG_STORAGE_KEY } from "../constants/config";
// internal atom for storing last sync time (from lastSyncedConfig meta)
const _lastSyncTimeBaseAtom = atom(null);
_lastSyncTimeBaseAtom.onMount = (setAtom) => {
    void storage.getMeta(`local:${LAST_SYNCED_CONFIG_STORAGE_KEY}`).then(meta => setAtom(meta?.lastSyncedAt ?? null));
    // Add $ to the key to get the meta key for LAST_SYNCED_CONFIG_STORAGE_KEY
    const metaKey = `local:${LAST_SYNCED_CONFIG_STORAGE_KEY}$`;
    const unwatch = storage.watch(metaKey, (newMeta, _) => {
        const meta = newMeta;
        setAtom(meta?.lastSyncedAt ?? null);
    });
    return unwatch;
};
// export read-only derived atom
export const lastSyncTimeAtom = atom(get => get(_lastSyncTimeBaseAtom));
