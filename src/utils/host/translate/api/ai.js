import { generateText } from "ai";
import { extractAISDKErrorMessage } from "@/utils/error/extract-message";
import { getModelById } from "@/utils/providers/model";
import { resolveModelId } from "@/utils/providers/model-id";
import { getProviderOptionsWithOverride } from "@/utils/providers/options";
import { attachRequestErrorMeta, getRequestErrorMeta } from "@/utils/request/retry-policy";
const THINK_TAG_RE = /<\/think>([\s\S]*)/;
export async function aiTranslate(text, targetLangName, providerConfig, promptResolver, options) {
    const { id: providerId, model: providerModel, provider, providerOptions: userProviderOptions, temperature } = providerConfig;
    const modelName = resolveModelId(providerModel);
    const model = await getModelById(providerId);
    const providerOptions = getProviderOptionsWithOverride(modelName ?? "", provider, userProviderOptions);
    const { systemPrompt, prompt } = await promptResolver(targetLangName, text, options);
    try {
        const { text: translatedText } = await generateText({
            model,
            system: systemPrompt,
            prompt,
            temperature,
            providerOptions,
            maxRetries: 0, // Disable SDK built-in retries, let RequestQueue/BatchQueue handle it
        });
        const [, finalTranslation = translatedText] = translatedText.match(THINK_TAG_RE) || [];
        return finalTranslation;
    }
    catch (error) {
        const message = extractAISDKErrorMessage(error);
        const meta = getRequestErrorMeta(error);
        if (error instanceof Error) {
            error.message = message;
            throw attachRequestErrorMeta(error, meta);
        }
        throw attachRequestErrorMeta(new Error(message), meta);
    }
}
