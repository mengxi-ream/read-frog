import { defineContentScript } from "#imports"
import { runContentLoader } from "@/utils/content-runtime/loader"
import { takeRequestedParts } from "@/utils/content-runtime/parts"

export default defineContentScript({
  matches: ["*://*/*", "file:///*"],
  async main() {
    await runContentLoader(takeRequestedParts(globalThis, window === window.top))
  },
})
