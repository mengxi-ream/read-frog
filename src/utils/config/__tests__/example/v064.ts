import type { TestSeriesObject } from "./types"
import { createDefaultTTSLanguageVoices, EDGE_TTS_FALLBACK_VOICE } from "@/types/config/tts"

export const testSeries: TestSeriesObject = {
  "complex-config-from-v020": {
    description: "Adds enabled toggle to selection toolbar built-in features and adds speak feature",
    config: {
      language: {
        sourceCode: "spa",
        targetCode: "eng",
        level: "advanced",
      },
      providersConfig: [
        {
          id: "microsoft-translate-default",
          enabled: true,
          name: "Microsoft Translator",
          provider: "microsoft-translate",
        },
        {
          id: "google-translate-default",
          enabled: true,
          name: "Google Translate",
          provider: "google-translate",
        },
        {
          id: "openai-default",
          enabled: true,
          name: "OpenAI",
          provider: "openai",
          apiKey: "sk-custom-prompt-key",
          baseURL: "https://api.openai.com/v1",
          model: {
            model: "gpt-4o-mini",
            isCustomModel: true,
            customModel: "translate-gpt-custom",
          },
        },
        {
          id: "deepseek-default",
          enabled: true,
          name: "DeepSeek",
          provider: "deepseek",
          apiKey: "ds-custom",
          baseURL: "https://api.custom.com/v1",
          model: {
            model: "deepseek-chat",
            isCustomModel: false,
            customModel: "",
          },
        },
        {
          id: "google-default",
          enabled: true,
          name: "Gemini",
          provider: "google",
          apiKey: undefined,
          baseURL: undefined,
          model: {
            model: "gemini-2.5-pro",
            isCustomModel: false,
            customModel: "",
          },
        },
        {
          id: "deeplx-default",
          enabled: true,
          name: "DeepLX",
          provider: "deeplx",
          apiKey: undefined,
          baseURL: "https://deeplx.vercel.app",
        },
      ],
      translate: {
        providerId: "openai-default",
        mode: "translationOnly",
        enableAIContentAware: false,
        node: {
          enabled: true,
          hotkey: "alt",
        },
        page: {
          range: "all",
          autoTranslatePatterns: ["spanish-news.com", "elmundo.es"],
          autoTranslateLanguages: [],
          shortcut: ["alt", "b"],
          preload: {
            margin: 1000,
            threshold: 0,
          },
          minCharactersPerNode: 0,
          minWordsPerNode: 0,
          skipLanguages: [],
        },
        customPromptsConfig: {
          promptId: "123e4567-e89b-12d3-a456-426614174000",
          patterns: [
            {
              id: "123e4567-e89b-12d3-a456-426614174000",
              name: "Technical Translation",
              systemPrompt: "",
              prompt: "Technical translation from Spanish to {{targetLanguage}}. Preserve technical terms and accuracy:\n{{input}}",
            },
          ],
        },
        requestQueueConfig: {
          capacity: 400,
          rate: 8,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        translationNodeStyle: {
          preset: "blur",
          isCustom: false,
          customCSS: null,
        },
      },
      tts: {
        defaultVoice: EDGE_TTS_FALLBACK_VOICE,
        languageVoices: createDefaultTTSLanguageVoices(),
        rate: 0,
        pitch: 0,
        volume: 0,
      },
      floatingButton: {
        enabled: true,
        position: 0.75,
        disabledFloatingButtonPatterns: ["github.com"],
        clickAction: "panel",
      },
      sideContent: {
        width: 700,
      },
      selectionToolbar: {
        enabled: false,
        disabledSelectionToolbarPatterns: [],
        customActions: [
          {
            id: "default-dictionary",
            name: "Dictionary",
            enabled: true,
            icon: "tabler:book-2",
            providerId: "deepseek-default",
            systemPrompt:
          "You are a dictionary assistant for language learners. Given a term and its surrounding paragraphs, provide a comprehensive and concise dictionary entry. When a term has multiple meanings, focus on the contextual meaning. Return the term in its base/canonical form. Respond in {{targetLanguage}}.",
            prompt: "Term: {{selection}}\nParagraphs: {{paragraphs}}\nTarget language: {{targetLanguage}}",
            outputSchema: [
              { id: "default-dictionary-term", name: "Term", type: "string", description: "", speaking: true },
              { id: "default-dictionary-definition", name: "Definition", type: "string", description: "", speaking: false },
              { id: "default-dictionary-context", name: "Paragraphs", type: "string", description: "", speaking: true },
              { id: "default-dictionary-examples", name: "Examples", type: "string", description: "", speaking: false },
              { id: "default-dictionary-synonyms", name: "Synonyms", type: "string", description: "", speaking: false },
              { id: "default-dictionary-antonyms", name: "Antonyms", type: "string", description: "", speaking: false },
            ],
          },
        ],
        features: {
          translate: {
            enabled: true,
            providerId: "openai-default",
          },
          speak: {
            enabled: true,
          },
          vocabularyInsight: {
            enabled: true,
            providerId: "deepseek-default",
          },
        },
      },
      betaExperience: {
        enabled: false,
      },
      contextMenu: {
        enabled: true,
      },
      videoSubtitles: {
        enabled: false,
        autoStart: false,
        providerId: "openai-default",
        style: {
          displayMode: "bilingual",
          translationPosition: "above",
          main: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          translation: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          container: {
            backgroundOpacity: 75,
          },
        },
        aiSegmentation: false,
        requestQueueConfig: {
          capacity: 400,
          rate: 8,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        customPromptsConfig: {
          promptId: null,
          patterns: [],
        },
        position: { percent: 10, anchor: "bottom" },
      },
      inputTranslation: {
        enabled: true,
        providerId: "openai-default",
        fromLang: "targetCode",
        toLang: "sourceCode",
        enableCycle: false,
        timeThreshold: 300,
      },
      siteControl: {
        mode: "blacklist",
        blacklistPatterns: [],
        whitelistPatterns: [],
      },
      languageDetection: {
        mode: "basic",
        providerId: "openai-default",
      },
    },
  },
  "config-with-llm-detection-enabled": {
    description: "Single provider, LLM detection mode; features get enabled toggles and speak added",
    config: {
      language: {
        sourceCode: "jpn",
        targetCode: "eng",
        level: "beginner",
      },
      providersConfig: [
        {
          id: "google-default",
          enabled: true,
          name: "Gemini",
          provider: "google",
          apiKey: "goog-key",
          model: {
            model: "gemini-2.5-pro",
            isCustomModel: false,
            customModel: "",
          },
        },
      ],
      translate: {
        providerId: "google-default",
        mode: "translationOnly",
        enableAIContentAware: false,
        node: {
          enabled: true,
          hotkey: "alt",
        },
        page: {
          range: "all",
          autoTranslatePatterns: [],
          autoTranslateLanguages: [],
          shortcut: ["alt", "b"],
          preload: {
            margin: 1000,
            threshold: 0,
          },
          minCharactersPerNode: 0,
          minWordsPerNode: 0,
          skipLanguages: [],
        },
        customPromptsConfig: {
          promptId: null,
          patterns: [],
        },
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        translationNodeStyle: {
          preset: "default",
          isCustom: false,
          customCSS: null,
        },
      },
      tts: {
        defaultVoice: EDGE_TTS_FALLBACK_VOICE,
        languageVoices: createDefaultTTSLanguageVoices(),
        rate: 0,
        pitch: 0,
        volume: 0,
      },
      floatingButton: {
        enabled: true,
        position: 0.5,
        disabledFloatingButtonPatterns: [],
        clickAction: "panel",
      },
      sideContent: {
        width: 420,
      },
      selectionToolbar: {
        enabled: true,
        disabledSelectionToolbarPatterns: [],
        customActions: [
          {
            id: "default-dictionary",
            name: "Dictionary",
            enabled: true,
            icon: "tabler:book-2",
            providerId: "google-default",
            systemPrompt:
          "You are a dictionary assistant for language learners. Given a term and its surrounding paragraphs, provide a comprehensive and concise dictionary entry. When a term has multiple meanings, focus on the contextual meaning. Return the term in its base/canonical form. Respond in {{targetLanguage}}.",
            prompt: "Term: {{selection}}\nParagraphs: {{paragraphs}}\nTarget language: {{targetLanguage}}",
            outputSchema: [
              { id: "default-dictionary-term", name: "Term", type: "string", description: "", speaking: true },
              { id: "default-dictionary-definition", name: "Definition", type: "string", description: "", speaking: false },
              { id: "default-dictionary-context", name: "Paragraphs", type: "string", description: "", speaking: true },
              { id: "default-dictionary-examples", name: "Examples", type: "string", description: "", speaking: false },
              { id: "default-dictionary-synonyms", name: "Synonyms", type: "string", description: "", speaking: false },
              { id: "default-dictionary-antonyms", name: "Antonyms", type: "string", description: "", speaking: false },
            ],
          },
        ],
        features: {
          translate: {
            enabled: true,
            providerId: "google-default",
          },
          speak: {
            enabled: true,
          },
          vocabularyInsight: {
            enabled: true,
            providerId: "google-default",
          },
        },
      },
      betaExperience: {
        enabled: false,
      },
      contextMenu: {
        enabled: true,
      },
      videoSubtitles: {
        enabled: false,
        autoStart: false,
        providerId: "google-default",
        style: {
          displayMode: "bilingual",
          translationPosition: "above",
          main: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          translation: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          container: {
            backgroundOpacity: 75,
          },
        },
        aiSegmentation: false,
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        customPromptsConfig: {
          promptId: null,
          patterns: [],
        },
        position: { percent: 10, anchor: "bottom" },
      },
      inputTranslation: {
        enabled: true,
        providerId: "google-default",
        fromLang: "targetCode",
        toLang: "sourceCode",
        enableCycle: false,
        timeThreshold: 300,
      },
      siteControl: {
        mode: "blacklist",
        blacklistPatterns: [],
        whitelistPatterns: [],
      },
      languageDetection: {
        mode: "llm",
        providerId: "google-default",
      },
    },
  },
  "prompt-token-migration-coverage": {
    description: "Covers legacy prompt token migration for translate, custom actions, and video subtitles",
    config: {
      language: {
        sourceCode: "eng",
        targetCode: "cmn",
        level: "intermediate",
      },
      providersConfig: [
        {
          id: "google-default",
          enabled: true,
          name: "Gemini",
          provider: "google",
          apiKey: "goog-key",
          model: {
            model: "gemini-2.5-pro",
            isCustomModel: false,
            customModel: "",
          },
        },
      ],
      translate: {
        providerId: "google-default",
        mode: "translationOnly",
        enableAIContentAware: false,
        node: {
          enabled: true,
          hotkey: "alt",
        },
        page: {
          range: "all",
          autoTranslatePatterns: [],
          autoTranslateLanguages: [],
          shortcut: ["alt", "b"],
          preload: {
            margin: 1000,
            threshold: 0,
          },
          minCharactersPerNode: 0,
          minWordsPerNode: 0,
          skipLanguages: [],
        },
        customPromptsConfig: {
          promptId: "legacy-translate-prompt",
          patterns: [
            {
              id: "legacy-translate-prompt",
              name: "Legacy Translate Prompt",
              systemPrompt: "Translate into {{targetLanguage}} with title {{webTitle}} and summary {{webSummary}}.",
              prompt: "Title: {{webTitle}}\nSummary: {{webSummary}}\nTranslate to {{targetLanguage}}:\n{{input}}",
            },
          ],
        },
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        translationNodeStyle: {
          preset: "default",
          isCustom: false,
          customCSS: null,
        },
      },
      tts: {
        defaultVoice: EDGE_TTS_FALLBACK_VOICE,
        languageVoices: createDefaultTTSLanguageVoices(),
        rate: 0,
        pitch: 0,
        volume: 0,
      },
      floatingButton: {
        enabled: true,
        position: 0.5,
        disabledFloatingButtonPatterns: [],
        clickAction: "panel",
      },
      sideContent: {
        width: 420,
      },
      selectionToolbar: {
        enabled: true,
        disabledSelectionToolbarPatterns: [],
        customActions: [
          {
            id: "coverage-action",
            name: "Coverage Action",
            enabled: true,
            icon: "tabler:book-2",
            providerId: "google-default",
            systemPrompt: "Answer in {{targetLanguage}} and use {{webTitle}} as metadata.",
            prompt: "Selection: {{selection}}\nContext: {{paragraphs}}\nTitle: {{webTitle}}\nTarget language: {{targetLanguage}}",
            outputSchema: [
              { id: "coverage-term", name: "Term", type: "string", description: "Focus on {{selection}}.", speaking: true },
              { id: "coverage-definition", name: "Definition", type: "string", description: "Explain it in {{targetLanguage}}.", speaking: false },
              { id: "coverage-context", name: "Context", type: "string", description: "Reuse {{paragraphs}} exactly.", speaking: true },
              { id: "coverage-notes", name: "Notes", type: "string", description: "Mention {{webTitle}} when relevant.", speaking: false },
            ],
          },
        ],
        features: {
          translate: {
            enabled: true,
            providerId: "google-default",
          },
          speak: {
            enabled: true,
          },
          vocabularyInsight: {
            enabled: true,
            providerId: "google-default",
          },
        },
      },
      betaExperience: {
        enabled: false,
      },
      contextMenu: {
        enabled: true,
      },
      videoSubtitles: {
        enabled: false,
        autoStart: false,
        providerId: "google-default",
        style: {
          displayMode: "bilingual",
          translationPosition: "above",
          main: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          translation: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          container: {
            backgroundOpacity: 75,
          },
        },
        aiSegmentation: false,
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        customPromptsConfig: {
          promptId: "legacy-subtitles-prompt",
          patterns: [
            {
              id: "legacy-subtitles-prompt",
              name: "Legacy Subtitles Prompt",
              systemPrompt: "Translate subtitles into {{targetLanguage}} with {{webTitle}} and {{webSummary}} as context.",
              prompt: "Title: {{webTitle}}\nSummary: {{webSummary}}\nTranslate to {{targetLanguage}}:\n{{input}}",
            },
          ],
        },
        position: { percent: 10, anchor: "bottom" },
      },
      inputTranslation: {
        enabled: true,
        providerId: "google-default",
        fromLang: "targetCode",
        toLang: "sourceCode",
        enableCycle: false,
        timeThreshold: 300,
      },
      siteControl: {
        mode: "blacklist",
        blacklistPatterns: [],
        whitelistPatterns: [],
      },
      languageDetection: {
        mode: "basic",
        providerId: "google-default",
      },
    },
  },
  "default-dictionary-wording": {
    description: "Renames dictionary wording from context to paragraphs",
    config: {
      language: {
        sourceCode: "eng",
        targetCode: "cmn",
        level: "intermediate",
      },
      providersConfig: [
        {
          id: "google-default",
          enabled: true,
          name: "Gemini",
          provider: "google",
          apiKey: "goog-key",
          model: {
            model: "gemini-2.5-pro",
            isCustomModel: false,
            customModel: "",
          },
        },
      ],
      translate: {
        providerId: "google-default",
        mode: "translationOnly",
        enableAIContentAware: false,
        node: {
          enabled: true,
          hotkey: "alt",
        },
        page: {
          range: "all",
          autoTranslatePatterns: [],
          autoTranslateLanguages: [],
          shortcut: ["alt", "b"],
          preload: {
            margin: 1000,
            threshold: 0,
          },
          minCharactersPerNode: 0,
          minWordsPerNode: 0,
          skipLanguages: [],
        },
        customPromptsConfig: {
          promptId: null,
          patterns: [],
        },
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        translationNodeStyle: {
          preset: "default",
          isCustom: false,
          customCSS: null,
        },
      },
      tts: {
        defaultVoice: EDGE_TTS_FALLBACK_VOICE,
        languageVoices: createDefaultTTSLanguageVoices(),
        rate: 0,
        pitch: 0,
        volume: 0,
      },
      floatingButton: {
        enabled: true,
        position: 0.5,
        disabledFloatingButtonPatterns: [],
        clickAction: "panel",
      },
      sideContent: {
        width: 420,
      },
      selectionToolbar: {
        enabled: true,
        disabledSelectionToolbarPatterns: [],
        customActions: [
          {
            id: "default-dictionary",
            name: "Dictionary",
            enabled: true,
            icon: "tabler:book-2",
            providerId: "google-default",
            systemPrompt: `You are a dictionary assistant for language learners.

## Goal
Given a term and its surrounding paragraphs, produce a concise dictionary entry that matches the required output object.

## Rules
1. Focus on the meaning that best matches the provided paragraphs.
2. Normalize Term to its base/canonical form.
3. Keep Definition precise and learner-friendly.
4. Keep Paragraphs exactly as provided in the prompt.
5. Phonetic must use the standard notation for the term's language (e.g., IPA for English, pinyin for Mandarin, romaji for Japanese).
6. Part of Speech in English (noun, verb, adjective, etc.).
7. Difficulty must be a CEFR level (A1, A2, B1, B2, C1, or C2).
8. If a field is unknown, return an empty string instead of guessing.
9. Respond in {{targetLanguage}} for all textual fields unless source-form text is required for clarity.

## Examples

### Example 1
Input: Selection="blossoms", Paragraphs="The ephemeral beauty of cherry blossoms reminds us to cherish each moment.", Target language=Chinese

Output:
- Term: blossom
- Phonetic: /ˈblɒs.əm/
- Part of Speech: noun
- Paragraphs: The ephemeral beauty of cherry blossoms reminds us to cherish each moment.
- Definition: 花；花朵（尤指果树的花）
- Paragraphs Translation: 樱花短暂的美丽提醒我们珍惜每一刻。
- Difficulty: B2

### Example 2
Input: Selection="感動", Paragraphs="この映画はつまらないと思ったけど、最後は感動した。", Target language=English

Output:
- Term: 感動
- Phonetic: kandou
- Part of Speech: noun
- Paragraphs: この映画はつまらないと思ったけど、最後は感動した。
- Definition: Being deeply moved; emotional touch
- Paragraphs Translation: I thought this movie was boring, but the ending was moving.
- Difficulty: B1`,
            prompt: `## Input
Selection: {{selection}}
Paragraphs: {{paragraphs}}
Target language: {{targetLanguage}}`,
            outputSchema: [
              { id: "default-dictionary-term", name: "Term", type: "string", description: "Base/canonical lemma of the selected term.", speaking: true },
              { id: "default-dictionary-phonetic", name: "Phonetic", type: "string", description: "Standard phonetic transcription for the term's language (e.g., IPA for English, pinyin for Mandarin, romaji for Japanese).", speaking: false },
              { id: "default-dictionary-part-of-speech", name: "Part of Speech", type: "string", description: "Grammatical category (e.g., noun, verb, adjective).", speaking: false },
              { id: "default-dictionary-definition", name: "Definition", type: "string", description: "One concise definition for the contextual sense.", speaking: false },
              { id: "default-dictionary-context", name: "Paragraphs", type: "string", description: "The paragraphs from the prompt above. Do not rewrite them.", speaking: true },
              { id: "default-dictionary-context-translation", name: "Paragraphs Translation", type: "string", description: "The translation of the paragraphs.", speaking: false },
              { id: "default-dictionary-difficulty", name: "Difficulty", type: "string", description: "Estimated CEFR difficulty level A1, A2, B1, B2, C1, or C2.", speaking: false },
            ],
          },
        ],
        features: {
          translate: {
            enabled: true,
            providerId: "google-default",
          },
          speak: {
            enabled: true,
          },
          vocabularyInsight: {
            enabled: true,
            providerId: "google-default",
          },
        },
      },
      betaExperience: {
        enabled: false,
      },
      contextMenu: {
        enabled: true,
      },
      videoSubtitles: {
        enabled: false,
        autoStart: false,
        providerId: "google-default",
        style: {
          displayMode: "bilingual",
          translationPosition: "above",
          main: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          translation: {
            fontFamily: "system",
            fontScale: 100,
            color: "#FFFFFF",
            fontWeight: 400,
          },
          container: {
            backgroundOpacity: 75,
          },
        },
        aiSegmentation: false,
        requestQueueConfig: {
          capacity: 200,
          rate: 2,
        },
        batchQueueConfig: {
          maxCharactersPerBatch: 1000,
          maxItemsPerBatch: 4,
        },
        customPromptsConfig: {
          promptId: null,
          patterns: [],
        },
        position: { percent: 10, anchor: "bottom" },
      },
      inputTranslation: {
        enabled: true,
        providerId: "google-default",
        fromLang: "targetCode",
        toLang: "sourceCode",
        enableCycle: false,
        timeThreshold: 300,
      },
      siteControl: {
        mode: "blacklist",
        blacklistPatterns: [],
        whitelistPatterns: [],
      },
      languageDetection: {
        mode: "basic",
        providerId: "google-default",
      },
    },
  },
}
