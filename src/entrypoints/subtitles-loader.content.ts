import { defineContentScript } from "#imports"
import { runContentLoader } from "@/utils/content-runtime/loader"
import { sendMessage } from "@/utils/message"
import { subtitlesContentScriptMatches } from "./subtitles.content/content-script-matches"

/**
 * Video subtitles. Like the loader every page gets, this only decides whether
 * to import the shared content runtime, which then runs the subtitles part.
 * It goes into every frame of the video sites: a player can be embedded in
 * another site's page.
 */
export default defineContentScript({
  matches: subtitlesContentScriptMatches,
  allFrames: true,
  async main() {
    await runContentLoader(["subtitles"], {
      getTopPageUrl: window === window.top ? undefined : () => sendMessage("getSenderTabUrl"),
    })
  },
})
