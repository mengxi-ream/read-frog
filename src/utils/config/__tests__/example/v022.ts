import type { TestSeriesObject } from "./types"

export const testSeries: TestSeriesObject = {
  "default": {
    description: "Allow arbitrary custom providers",
    config: {
      language: {
        detectedCode: "eng",
        sourceCode: "auto",
        targetCode: "jpn",
        level: "intermediate",
      },
      providersConfig: [
        {
          name: "Google Translate",
          provider: "google",
        },
        {
          name: "Microsoft Translator",
          provider: "microsoft",
        },
        {
          name: "OpenAI",
          provider: "openai",
          apiKey: "sk-1234567890",
          baseURL: "https://api.openai.com/v1",
          models: {
            read: {
              model: "gpt-4o-mini",
              isCustomModel: true,
              customModel: "gpt-4.1-nano",
            },
            translate: {
              model: "gpt-4o-mini",
              isCustomModel: true,
              customModel: "gpt-4.1-nano",
            },
          },
        },
        {
          name: "DeepSeek",
          provider: "deepseek",
          apiKey: undefined,
          baseURL: "https://api.deepseek.com/v1",
          models: {
            read: {
              model: "deepseek-chat",
              isCustomModel: false,
              customModel: "",
            },
            translate: {
              model: "deepseek-chat",
              isCustomModel: false,
              customModel: "",
            },
          },
        },
        {
          name: "Gemini",
          provider: "gemini",
          apiKey: undefined,
          baseURL: "https://generativelanguage.googleapis.com/v1beta",
          models: {
            read: {
              model: "gemini-2.5-pro",
              isCustomModel: false,
              customModel: "",
            },
            translate: {
              model: "gemini-2.5-pro",
              isCustomModel: false,
              customModel: "",
            },
          },
        },
        {
          name: "DeepLX",
          provider: "deeplx",
          apiKey: undefined,
          baseURL: "https://deeplx.vercel.app",
        },
      ],
      read: {
        providerName: "OpenAI",
      },
      translate: {
        providerName: "Microsoft Translator",
        mode: "bilingual",
        node: {
          enabled: true,
          hotkey: "Control",
        },
        page: {
          range: "main",
          autoTranslatePatterns: ["news.ycombinator.com"],
          autoTranslateLanguages: [],
        },
        promptsConfig: {
          prompt: "default",
          patterns: [
            {
              id: "default",
              name: "default",
              prompt: `You are a professional {{targetLang}} native translator who needs to fluently translate text into {{targetLang}}.

## Translation Rules
1. Output only the translated content, without explanations or additional content (such as "Here's the translation:" or "Translation as follows:")
2. The returned translation must maintain exactly the same number of paragraphs and format as the original text.
3. If the text contains HTML tags, consider where the tags should be placed in the translation while maintaining fluency.
4. For content that should not be translated (such as proper nouns, code, etc.), keep the original text.

Translate to {{targetLang}}:
{{input}}
`,
            },
          ],
        },
        requestQueueConfig: {
          capacity: 300,
          rate: 5,
        },
        translationNodeStyle: "default",
        customAutoTranslateShortcutKey: ["alt", "q"],
      },
      floatingButton: {
        enabled: true,
        position: 0.66,
        disabledFloatingButtonPatterns: [],
      },
      sideContent: {
        width: 600,
      },
      selectionToolbar: { enabled: true },
    },
  },
  "complex-config-from-v020": {
    description: "Allow arbitrary custom providers",
    config: {
      language: {
        detectedCode: "spa",
        sourceCode: "spa",
        targetCode: "eng",
        level: "advanced",
      },
      providersConfig: [
        {
          name: "Google Translate",
          provider: "google",
        },
        {
          name: "Microsoft Translator",
          provider: "microsoft",
        },
        {
          name: "OpenAI",
          provider: "openai",
          apiKey: "sk-custom-prompt-key",
          baseURL: "https://api.openai.com/v1",
          models: {
            read: {
              model: "gpt-4o-mini",
              isCustomModel: true,
              customModel: "gpt-5-custom",
            },
            translate: {
              model: "gpt-4o-mini",
              isCustomModel: true,
              customModel: "translate-gpt-custom",
            },
          },
        },
        {
          name: "DeepSeek",
          provider: "deepseek",
          apiKey: "ds-custom",
          baseURL: "https://api.custom.com/v1",
          models: {
            read: {
              model: "deepseek-chat",
              isCustomModel: true,
              customModel: "deepseek-v4-pro",
            },
            translate: {
              model: "deepseek-chat",
              isCustomModel: false,
              customModel: "",
            },
          },
        },
        {
          name: "Gemini",
          provider: "gemini",
          apiKey: undefined,
          baseURL: undefined,
          models: {
            read: {
              model: "gemini-2.5-pro",
              isCustomModel: false,
              customModel: "",
            },
            translate: {
              model: "gemini-2.5-pro",
              isCustomModel: false,
              customModel: "",
            },
          },
        },
        {
          name: "DeepLX",
          provider: "deeplx",
          apiKey: undefined,
          baseURL: "https://deeplx.vercel.app",
        },
      ],
      read: {
        providerName: "DeepSeek",
      },
      translate: {
        providerName: "OpenAI",
        mode: "translationOnly",
        node: {
          enabled: true,
          hotkey: "Alt",
        },
        page: {
          range: "all",
          autoTranslatePatterns: ["spanish-news.com", "elmundo.es"],
          autoTranslateLanguages: [],
        },
        promptsConfig: {
          prompt: "123e4567-e89b-12d3-a456-426614174000",
          patterns: [
            {
              id: "default",
              name: "default",
              prompt: `You are a professional {{targetLang}} native translator who needs to fluently translate text into {{targetLang}}.

## Translation Rules
1. Output only the translated content, without explanations or additional content (such as "Here's the translation:" or "Translation as follows:")
2. The returned translation must maintain exactly the same number of paragraphs and format as the original text.
3. If the text contains HTML tags, consider where the tags should be placed in the translation while maintaining fluency.
4. For content that should not be translated (such as proper nouns, code, etc.), keep the original text.

Translate to {{targetLang}}:
{{input}}
`,
            },
            {
              id: "123e4567-e89b-12d3-a456-426614174000",
              name: "Technical Translation",
              prompt: "Technical translation from Spanish to {{targetLang}}. Preserve technical terms and accuracy:\n{{input}}",
            },
          ],
        },
        requestQueueConfig: {
          capacity: 400,
          rate: 8,
        },
        translationNodeStyle: "blur",
        customAutoTranslateShortcutKey: ["alt", "b"],
      },
      floatingButton: {
        enabled: true,
        position: 0.75,
        disabledFloatingButtonPatterns: ["github.com"],
      },
      sideContent: {
        width: 700,
      },
      selectionToolbar: { enabled: false },
    },
  },
  "config-from-v022": {
    description: "Config from v022",
    config: {
      floatingButton: {
        disabledFloatingButtonPatterns: [],
        enabled: true,
        position: 0.66,
      },
      language: {
        detectedCode: "eng",
        level: "intermediate",
        sourceCode: "auto",
        targetCode: "cmn",
      },
      providersConfig: [
        {
          name: "Google Translate",
          provider: "google",
        },
        {
          name: "Microsoft Translator",
          provider: "microsoft",
        },
        {
          apiKey: "123aqe",
          baseURL: "https://123",
          models: {
            read: {
              customModel: null,
              isCustomModel: false,
              model: "gpt-4.1-mini",
            },
            translate: {
              customModel: "gpt-4.1-m",
              isCustomModel: true,
              model: "gpt-4.1-mini",
            },
          },
          name: "OpenAI",
          provider: "openai",
        },
        {
          models: {
            read: {
              customModel: null,
              isCustomModel: false,
              model: "deepseek-chat",
            },
            translate: {
              customModel: null,
              isCustomModel: false,
              model: "deepseek-chat",
            },
          },
          name: "DeepSeek",
          provider: "deepseek",
        },
        {
          apiKey: "1",
          models: {
            read: {
              customModel: null,
              isCustomModel: false,
              model: "gemini-2.5-pro",
            },
            translate: {
              customModel: "gemini-1.5-pro",
              isCustomModel: true,
              model: "gemini-1.5-pro",
            },
          },
          name: "Gemini",
          provider: "gemini",
        },
        {
          apiKey: "11113",
          name: "DeepLX",
          provider: "deeplx",
        },
      ],
      read: {
        providerName: "DeepSeek",
      },
      selectionToolbar: {
        enabled: true,
      },
      sideContent: {
        width: 420,
      },
      translate: {
        customAutoTranslateShortcutKey: [
          "alt",
          "q",
        ],
        mode: "translationOnly",
        node: {
          enabled: true,
          hotkey: "Control",
        },
        page: {
          autoTranslateLanguages: [],
          autoTranslatePatterns: [
            "news.ycombinator.com",
          ],
          range: "all",
        },
        promptsConfig: {
          patterns: [
            {
              id: "default",
              name: "default",
              prompt: "You are a professional {{targetLang}} native translator who needs to fluently translate text into {{targetLang}}.\n\n## Translation Rules\n1. Output only the translated content, without explanations or additional content (such as \"Here's the translation:\" or \"Translation as follows:\")\n2. The returned translation must maintain exactly the same number of paragraphs and format as the original text.\n3. If the text contains HTML tags, consider where the tags should be placed in the translation while maintaining fluency.\n4. For content that should not be translated (such as proper nouns, code, etc.), keep the original text.\n\nTranslate to {{targetLang}}:\n{{input}}\n",
            },
          ],
          prompt: "default",
        },
        providerName: "Gemini",
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        translationNodeStyle: "default",
      },
    },
  },
}
