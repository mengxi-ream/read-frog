// On its own so the loader content script, which runs on every page, can read
// the stored config without bundling the defaults in ./config.
export const CONFIG_STORAGE_KEY = "config"
