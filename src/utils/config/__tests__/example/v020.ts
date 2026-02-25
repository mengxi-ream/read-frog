import type { TestSeriesObject } from "./types"

export const testSeries: TestSeriesObject = {
  "default": {
    description: "add empty disabledFloatingButtonPatterns",
    config: {
      language: {
        detectedCode: "eng",
        sourceCode: "auto",
        targetCode: "jpn",
        level: "intermediate",
      },
      providersConfig: {
        openai: {
          apiKey: "sk-1234567890",
          baseURL: "https://api.openai.com/v1",
        },
        deepseek: {
          apiKey: undefined,
          baseURL: "https://api.deepseek.com/v1",
        },
        gemini: {
          apiKey: undefined,
          baseURL: "https://generativelanguage.googleapis.com/v1beta",
        },
        deeplx: {
          apiKey: undefined,
          baseURL: "https://deeplx.vercel.app",
        },
      },
      read: {
        provider: "openai",
        models: {
          openai: {
            model: "gpt-4o-mini",
            isCustomModel: true,
            customModel: "gpt-4.1-nano",
          },
          deepseek: {
            model: "deepseek-chat",
            isCustomModel: false,
            customModel: "",
          },
          gemini: {
            model: "gemini-2.5-pro",
            isCustomModel: false,
            customModel: "",
          },
        },
      },
      translate: {
        provider: "microsoft",
        models: {
          microsoft: null,
          google: null,
          deeplx: null,
          openai: {
            model: "gpt-4o-mini",
            isCustomModel: true,
            customModel: "gpt-4.1-nano",
          },
          deepseek: {
            model: "deepseek-chat",
            isCustomModel: false,
            customModel: "",
          },
          gemini: {
            model: "gemini-2.5-pro",
            isCustomModel: false,
            customModel: "",
          },
        },
        mode: "bilingual",
        node: {
          enabled: true,
          hotkey: "Control",
        },
        page: {
          range: "main",
          autoTranslatePatterns: ["news.ycombinator.com"],
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
    description: "Complex config from v020",
    config: {
      language: {
        detectedCode: "spa",
        sourceCode: "spa",
        targetCode: "eng",
        level: "advanced",
      },
      providersConfig: {
        openai: {
          apiKey: "sk-custom-prompt-key",
          baseURL: "https://api.openai.com/v1",
        },
        deepseek: {
          apiKey: "ds-custom",
          baseURL: "https://api.custom.com/v1",
        },
        gemini: {
          apiKey: undefined,
          baseURL: "",
        },
        deeplx: {
          apiKey: undefined,
          baseURL: "https://deeplx.vercel.app",
        },
      },
      read: {
        provider: "deepseek",
        models: {
          openai: {
            model: "gpt-4o-mini",
            isCustomModel: true,
            customModel: "gpt-5-custom",
          },
          deepseek: {
            model: "deepseek-chat",
            isCustomModel: true,
            customModel: "deepseek-v4-pro",
          },
          gemini: {
            model: "gemini-2.5-pro",
            isCustomModel: false,
            customModel: "",
          },
        },
      },
      translate: {
        provider: "openai",
        models: {
          microsoft: null,
          google: null,
          deeplx: null,
          openai: {
            model: "gpt-4o-mini",
            isCustomModel: true,
            customModel: "translate-gpt-custom",
          },
          deepseek: {
            model: "deepseek-chat",
            isCustomModel: false,
            customModel: "",
          },
          gemini: {
            model: "gemini-2.5-pro",
            isCustomModel: false,
            customModel: "",
          },
        },
        mode: "translationOnly",
        node: {
          enabled: true,
          hotkey: "Alt",
        },
        page: {
          range: "all",
          autoTranslatePatterns: ["spanish-news.com", "elmundo.es"],
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
}
