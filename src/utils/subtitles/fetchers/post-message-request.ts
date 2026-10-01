import { POST_MESSAGE_TIMEOUT_MS } from "@/utils/constants/subtitles"
import { getRandomUUID } from "@/utils/crypto-polyfill"

export function postMessageRequest(
  responseType: string,
  message: Record<string, unknown>,
): Promise<any> {
  return new Promise((resolve) => {
    const requestId = getRandomUUID()

    const handler = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.data?.type !== responseType ||
        event.data?.requestId !== requestId
      ) {
        return
      }

      window.removeEventListener("message", handler)
      resolve(event.data)
    }

    window.addEventListener("message", handler)
    window.postMessage({ ...message, requestId }, window.location.origin)

    setTimeout(() => {
      window.removeEventListener("message", handler)
      resolve(null)
    }, POST_MESSAGE_TIMEOUT_MS)
  })
}
