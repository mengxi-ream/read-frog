import { atom } from "jotai";
import { DEFAULT_THEME_MODE, themeModeSchema } from "@/types/config/theme";
import { THEME_STORAGE_KEY } from "../constants/config";
import { logger } from "../logger";
import { storageAdapter } from "./storage-adapter";
// Private base atom. Only export this for top-level hydration before ThemeProvider mounts.
export const baseThemeModeAtom = atom(DEFAULT_THEME_MODE);
// Public atom with read/write - write always goes through storageAdapter
export const themeModeAtom = atom(get => get(baseThemeModeAtom), async (get, set, newValue) => {
    const prev = get(baseThemeModeAtom);
    set(baseThemeModeAtom, newValue);
    try {
        await storageAdapter.set(THEME_STORAGE_KEY, newValue, themeModeSchema);
    }
    catch (error) {
        console.error("Failed to set themeMode to storage:", newValue, error);
        set(baseThemeModeAtom, prev);
    }
});
baseThemeModeAtom.onMount = (setAtom) => {
    void storageAdapter.get(THEME_STORAGE_KEY, DEFAULT_THEME_MODE, themeModeSchema).then(setAtom);
    const unwatch = storageAdapter.watch(THEME_STORAGE_KEY, setAtom);
    const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
            logger.info("baseThemeModeAtom onMount handleVisibilityChange when: ", new Date());
            void storageAdapter.get(THEME_STORAGE_KEY, DEFAULT_THEME_MODE, themeModeSchema).then(setAtom);
        }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
        unwatch();
        document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
};
