import { browser } from "#imports"

export { APP_NAME } from "@read-frog/definitions"
const manifest = browser.runtime.getManifest()
export const EXTENSION_VERSION = manifest.version
