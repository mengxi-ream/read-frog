import { isLLMProviderConfig } from "@/types/config/provider";
import { sendMessage } from "@/utils/message";
export async function getOrGenerateWebPageSummary(webPageContext, providerConfig, enableAIContentAware) {
    if (!enableAIContentAware || !isLLMProviderConfig(providerConfig) || !webPageContext) {
        return null;
    }
    const { webTitle, webContent } = webPageContext;
    if (!webTitle.trim() || !webContent.trim()) {
        return null;
    }
    const summary = await sendMessage("getOrGenerateWebPageSummary", {
        webTitle,
        webContent,
        providerConfig,
    });
    return summary || null;
}
