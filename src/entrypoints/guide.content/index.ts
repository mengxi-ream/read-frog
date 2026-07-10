import type { Config } from "@/types/config/config"
import { kebabCase } from "case-anything"
import { defineContentScript, storage } from "#imports"
import { env } from "@/env"
import { getLocalConfig } from "@/utils/config/storage"
import { APP_NAME } from "@/utils/constants/app"
import { CONFIG_STORAGE_KEY } from "@/utils/constants/config"
import {
  getGuideDictionaryNotebaseState,
  startGuideDictionaryNotebaseTracking,
} from "@/utils/guide/dictionary-notebase"
import { onMessage, sendMessage } from "@/utils/message"

export default defineContentScript({
  matches: env.WXT_OFFICIAL_SITE_ORIGINS.map((origin: string) => `${origin}/*`),
  async main() {
    onMessage("pinStateChanged", (msg) => {
      window.postMessage({ source: `${kebabCase(APP_NAME)}-ext`, ...msg }, "*")
    })

    onMessage("guideDictionaryNotebaseStateChanged", (msg) => {
      window.postMessage({ source: `${kebabCase(APP_NAME)}-ext`, ...msg }, "*")
    })

    window.addEventListener("message", async (e) => {
      if (e.source !== window) return
      const { source, type } = e.data || {}
      if (source !== "read-frog-page") return

      if (type === "getPinState") {
        const isPinned = await sendMessage("getPinState", undefined)
        window.postMessage(
          { source: `${kebabCase(APP_NAME)}-ext`, type: "getPinState", data: { isPinned } },
          "*",
        )
      } else if (type === "startGuideDictionaryNotebaseTracking") {
        const state = await startGuideDictionaryNotebaseTracking(window.location.href)
        window.postMessage(
          {
            source: `${kebabCase(APP_NAME)}-ext`,
            type: "getGuideDictionaryNotebaseState",
            data: state,
          },
          "*",
        )
      } else if (type === "getGuideDictionaryNotebaseState") {
        const state = await getGuideDictionaryNotebaseState()
        window.postMessage(
          {
            source: `${kebabCase(APP_NAME)}-ext`,
            type: "getGuideDictionaryNotebaseState",
            data: state,
          },
          "*",
        )
      } else {
        const config = await getLocalConfig()
        if (!config) return

        if (type === "setTargetLanguage") {
          const langCodeISO6393 = e.data.langCodeISO6393 ?? "eng"
          // If we set storage too early, react of side content has not been mounted yet,
          // so this set storage will not trigger the watch of storage adapter of atom in react of side content
          // i.e. the side content will not be updated with the new config
          // thus extract query will set the target language back to initial config when it call setLanguage
          await new Promise((resolve) => setTimeout(resolve, 500))
          await storage.setItem<Config>(`local:${CONFIG_STORAGE_KEY}`, {
            ...config,
            language: { ...config.language, targetCode: langCodeISO6393 },
          })
        } else if (type === "getTargetLanguage") {
          const targetLanguage = config.language.targetCode
          window.postMessage(
            {
              source: `${kebabCase(APP_NAME)}-ext`,
              type: "getTargetLanguage",
              data: { targetLanguage },
            },
            "*",
          )
        }
      }
    })
  },
})
