import type { TestSeriesObject } from "./types"

export const testSeries: TestSeriesObject = {
  default: {
    description: "Add translation mode",
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
\`\`\`
{{input}}
\`\`\`
`,
            },
          ],
        },
        requestQueueConfig: {
          capacity: 300,
          rate: 5,
        },
        translationNodeStyle: "default",
      },
      floatingButton: {
        enabled: true,
        position: 0.66,
      },
      sideContent: {
        width: 600,
      },
      selectionToolbar: { enabled: true },
    },
  },
}
