import { defineContentScript } from "#imports"
import { INPUT_REPLACE_REQUEST_TYPE } from "@/utils/constants/input-injector"
import { replaceText } from "./replace-text"

export default defineContentScript({
  matches: ["*://*/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    if ((window as any).__READ_FROG_INPUT_INJECTOR__)
      return

    (window as any).__READ_FROG_INPUT_INJECTOR__ = true

    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin)
        return
      if (event.data?.type !== INPUT_REPLACE_REQUEST_TYPE)
        return

      replaceText(event.data.text)
    })
  },
})
