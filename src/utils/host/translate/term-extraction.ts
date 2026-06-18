import type { ProviderConfig } from "@/types/config/provider"
import { isLLMProviderConfig } from "@/types/config/provider"
import { sendMessage } from "@/utils/message"
import { Sha256Hex } from "../../hash"

interface CachedGlossary {
  pageUrl: string
  contentHash: string
  glossary: string
}

let cachedGlossary: CachedGlossary | null = null

export async function extractGlossary(
  pageContent: string,
  providerConfig: ProviderConfig,
): Promise<string | null> {
  if (!isLLMProviderConfig(providerConfig)) {
    return null
  }

  if (!pageContent.trim()) {
    return null
  }

  const contentHash = Sha256Hex(pageContent)

  // Return cached glossary for this page + content
  if (cachedGlossary?.pageUrl === window.location.href
    && cachedGlossary?.contentHash === contentHash) {
    return cachedGlossary.glossary
  }

  try {
    const glossary = await sendMessage("generateGlossary", {
      pageContent: pageContent.slice(0, 8000),
      providerConfig,
    })

    if (!glossary) {
      return null
    }

    cachedGlossary = {
      pageUrl: window.location.href,
      contentHash,
      glossary,
    }

    return glossary
  }
  catch (error) {
    // Graceful degradation: continue without glossary
    return null
  }
}

export function clearGlossaryCache(): void {
  cachedGlossary = null
}
