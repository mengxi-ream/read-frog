import { defineContentScript } from "#imports"
import { isAPIProvider } from "@/types/config/provider"
import {
  PARTNER_BRIDGE_OPEN_PROVIDER_CONFIG,
  PARTNER_BRIDGE_ORIGINS,
  PARTNER_BRIDGE_REQUEST_SOURCE,
  PARTNER_BRIDGE_RESPONSE_SOURCE,
} from "@/utils/constants/partner-bridge"
import { logger } from "@/utils/logger"
import { sendMessage } from "@/utils/message"
import { buildProviderTypeConfigRoute } from "@/utils/navigation"

const ALLOWED_ORIGINS = new Set<string>(PARTNER_BRIDGE_ORIGINS)

export default defineContentScript({
  matches: PARTNER_BRIDGE_ORIGINS.map((origin) => `${origin}/*`),
  main() {
    window.addEventListener("message", (event) => {
      // `matches` already keeps this script off every other site, so these two checks are about
      // the page itself: they stop a cross-origin iframe embedded in the partner page from
      // speaking for it.
      if (event.source !== window) return
      if (!ALLOWED_ORIGINS.has(event.origin)) return

      const { source, type, providerType } = (event.data ?? {}) as Record<string, unknown>
      if (source !== PARTNER_BRIDGE_REQUEST_SOURCE) return
      if (type !== PARTNER_BRIDGE_OPEN_PROVIDER_CONFIG) return

      if (typeof providerType !== "string" || !isAPIProvider(providerType)) {
        logger.warn("[partner-bridge] ignored openProviderConfig for unknown provider type", {
          providerType,
        })
        return
      }

      void sendMessage("openOptionsPage", {
        route: buildProviderTypeConfigRoute(providerType, { highlightApiKey: true }),
      })

      // Echoes back only what the page just told us, so a partner page can tell "the extension
      // is installed and took this" apart from silence.
      window.postMessage(
        {
          source: PARTNER_BRIDGE_RESPONSE_SOURCE,
          type: PARTNER_BRIDGE_OPEN_PROVIDER_CONFIG,
          data: { providerType },
        },
        event.origin,
      )
    })
  },
})
