// Builds the Safari extension in development mode, as `pnpm dev` does for
// Chrome, into .output/safari-mv3-dev. `pnpm dev:safari` runs this again
// whenever src/, public/ or wxt.config.ts changes.
//
// It's a plain build, not WXT's dev server: a dev-server build's background
// opens a WebSocket to the server when it starts, and in WebKit that socket
// never connects, so the background never finishes loading (seen with
// WebKit's WKWebExtension; not checked in Safari itself).
//
// To load it, use Safari > Settings > Developer > Add Temporary Extension….
// .output is a hidden folder, so the file picker's search can't find it:
// press ⌘⇧G there and paste the path this prints. After each rebuild, reload
// the extension under Settings > Extensions. Safari removes a temporary
// extension when it quits or after 24 hours.
import path from "node:path"
import { build } from "wxt"

const outDir = path.resolve(import.meta.dirname, "../.output/safari-mv3-dev")

await build({ browser: "safari", mode: "development" })
console.log(`
Safari build: ${outDir}
Reload Read Frog under Safari > Settings > Extensions to run it.
First time: in Safari > Settings > Developer, click Add Temporary Extension…, press ⌘⇧G and paste the path above.`)
