import { sendMessage } from "@/utils/message"

/**
 * The url of the page in this frame's tab, which site control goes by (see
 * isFrameSiteEnabled). A frame on another site, such as an embedded video
 * player, can't read it, so a child frame asks the background. Null when the
 * background can't answer.
 */
export async function getTopPageUrl(): Promise<string | null> {
  if (window === window.top) return window.location.href
  try {
    return await sendMessage("getSenderTabUrl")
  } catch {
    return null
  }
}
