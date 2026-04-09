import type { TestSeriesObject } from "./types"

const LEGACY_EDGE_TTS_FALLBACK_VOICE = "en-US-GuyNeural"

const LEGACY_TTS_LANGUAGE_VOICES = {
  "eng": "en-US-GuyNeural",
  "cmn": "zh-CN-YunxiNeural",
  "cmn-Hant": "zh-TW-YunJheNeural",
  "yue": "zh-CN-YunxiNeural",
  "spa": "es-ES-AlvaroNeural",
  "rus": "ru-RU-DmitryNeural",
  "arb": "ar-SA-HamedNeural",
  "ben": "bn-BD-NabanitaNeural",
  "hin": "hi-IN-MadhurNeural",
  "por": "pt-BR-AntonioNeural",
  "ind": "id-ID-ArdiNeural",
  "jpn": "ja-JP-KeitaNeural",
  "fra": "fr-FR-HenriNeural",
  "deu": "de-DE-ConradNeural",
  "jav": "jv-ID-DimasNeural",
  "kor": "ko-KR-InJoonNeural",
  "tel": "te-IN-MohanNeural",
  "vie": "vi-VN-NamMinhNeural",
  "mar": "mr-IN-ManoharNeural",
  "ita": "it-IT-DiegoNeural",
  "tam": "ta-IN-ValluvarNeural",
  "tur": "tr-TR-AhmetNeural",
  "urd": "ur-PK-AsadNeural",
  "guj": "gu-IN-NiranjanNeural",
  "pol": "pl-PL-MarekNeural",
  "ukr": "uk-UA-OstapNeural",
  "kan": "kn-IN-GaganNeural",
  "mai": "en-US-GuyNeural",
  "mal": "ml-IN-MidhunNeural",
  "pes": "fa-IR-FaridNeural",
  "mya": "my-MM-ThihaNeural",
  "swh": "sw-KE-RafikiNeural",
  "sun": "su-ID-JajangNeural",
  "ron": "ro-RO-EmilNeural",
  "pan": "pa-IN-OjasNeural",
  "bho": "en-US-GuyNeural",
  "amh": "am-ET-AmehaNeural",
  "hau": "ha-NG-AbubakarNeural",
  "fuv": "ff-Latn-SN-SambaNeural",
  "bos": "bs-BA-GoranNeural",
  "hrv": "hr-HR-SreckoNeural",
  "nld": "nl-NL-MaartenNeural",
  "srp": "sr-RS-NicholasNeural",
  "tha": "th-TH-NiwatNeural",
  "ckb": "en-US-GuyNeural",
  "yor": "yo-NG-AbeoNeural",
  "uzn": "uz-UZ-SardorNeural",
  "zlm": "ms-MY-OsmanNeural",
  "ibo": "ig-NG-EzinneNeural",
  "npi": "ne-NP-SagarNeural",
  "ceb": "en-US-GuyNeural",
  "skr": "en-US-GuyNeural",
  "tgl": "fil-PH-AngeloNeural",
  "hun": "hu-HU-TamasNeural",
  "azj": "az-AZ-BabekNeural",
  "sin": "si-LK-SameeraNeural",
  "koi": "en-US-GuyNeural",
  "ell": "el-GR-NestorasNeural",
  "ces": "cs-CZ-AntoninNeural",
  "mag": "en-US-GuyNeural",
  "run": "en-US-GuyNeural",
  "bel": "be-BY-YauheniNeural",
  "plt": "en-US-GuyNeural",
  "qug": "en-US-GuyNeural",
  "mad": "en-US-GuyNeural",
  "nya": "en-US-GuyNeural",
  "zyb": "en-US-GuyNeural",
  "pbu": "en-US-GuyNeural",
  "kin": "rw-RW-JeanNeural",
  "zul": "zu-ZA-ThembaNeural",
  "bul": "bg-BG-BorislavNeural",
  "swe": "sv-SE-MattiasNeural",
  "lin": "ln-CD-BaudouinNeural",
  "som": "so-SO-MuuseNeural",
  "hms": "en-US-GuyNeural",
  "hnj": "en-US-GuyNeural",
  "ilo": "en-US-GuyNeural",
  "kaz": "kk-KZ-DauletNeural",
  "heb": "he-IL-AvriNeural",
  "nob": "nb-NO-FinnNeural",
  "nno": "nn-NO-FinnNeural",
  "afr": "af-ZA-AdriNeural",
  "sqi": "sq-AL-IlirNeural",
  "asm": "as-IN-BiswajitNeural",
  "eus": "eu-ES-AnderNeural",
  "bre": "fr-FR-HenriNeural",
  "cat": "ca-ES-EnricNeural",
  "cos": "fr-FR-HenriNeural",
  "cym": "cy-GB-AledNeural",
  "dan": "da-DK-JeppeNeural",
  "div": "si-LK-SameeraNeural",
  "epo": "en-US-GuyNeural",
  "ekk": "et-EE-KertNeural",
  "fao": "fo-FO-PoulNeural",
  "fij": "en-US-GuyNeural",
  "fin": "fi-FI-HarriNeural",
  "fry": "nl-NL-MaartenNeural",
  "gla": "en-GB-RyanNeural",
  "gle": "ga-IE-ColmNeural",
  "glg": "gl-ES-RoiNeural",
  "grn": "es-ES-AlvaroNeural",
  "hat": "fr-FR-HenriNeural",
  "haw": "en-US-GuyNeural",
  "hye": "hy-AM-HaykNeural",
  "ido": "en-US-GuyNeural",
  "ina": "en-US-GuyNeural",
  "isl": "is-IS-GunnarNeural",
  "kat": "ka-GE-GiorgiNeural",
  "khm": "km-KH-PisethNeural",
  "kir": "kk-KZ-DauletNeural",
  "lao": "lo-LA-ChanthavongNeural",
  "lat": "it-IT-DiegoNeural",
  "lvs": "lv-LV-NilsNeural",
  "lit": "lt-LT-LeonasNeural",
  "ltz": "fr-FR-HenriNeural",
  "mkd": "mk-MK-AleksandarNeural",
  "mlt": "mt-MT-JosephNeural",
  "mon": "mn-MN-BataaNeural",
  "mri": "en-NZ-MitchellNeural",
  "nso": "en-US-GuyNeural",
  "oci": "fr-FR-HenriNeural",
  "ori": "or-IN-DineshNeural",
  "orm": "en-US-GuyNeural",
  "prs": "en-US-GuyNeural",
  "san": "hi-IN-MadhurNeural",
  "slk": "sk-SK-LukasNeural",
  "slv": "sl-SI-RokNeural",
  "smo": "en-US-GuyNeural",
  "sna": "en-US-GuyNeural",
  "snd": "sd-PK-SalmanNeural",
  "sot": "en-US-GuyNeural",
  "tah": "fr-FR-HenriNeural",
  "tat": "tt-RU-AidarNeural",
  "tgk": "tg-TJ-SharifNeural",
  "tir": "am-ET-AmehaNeural",
  "ton": "en-US-GuyNeural",
  "tsn": "en-US-GuyNeural",
  "tuk": "tk-TM-AmanNeural",
  "uig": "ug-CN-KashgarNeural",
  "vol": "en-US-GuyNeural",
  "wol": "en-US-GuyNeural",
  "xho": "xh-ZA-ThembaNeural",
  "ydd": "he-IL-AvriNeural",
  "aka": "en-US-GuyNeural",
  "bam": "fr-FR-HenriNeural",
  "bis": "en-US-GuyNeural",
  "bod": "zh-CN-YunxiNeural",
  "che": "ru-RU-DmitryNeural",
  "chv": "ru-RU-DmitryNeural",
  "dzo": "zh-CN-YunxiNeural",
  "ewe": "en-US-GuyNeural",
  "kab": "en-US-GuyNeural",
  "lug": "en-US-GuyNeural",
  "oss": "ru-RU-DmitryNeural",
  "ssw": "en-US-GuyNeural",
  "ven": "en-US-GuyNeural",
  "war": "en-US-GuyNeural",
  "nde": "en-US-GuyNeural",
  "nbl": "en-US-GuyNeural",
  "pam": "en-US-GuyNeural",
  "hil": "en-US-GuyNeural",
  "bcl": "en-US-GuyNeural",
  "min": "en-US-GuyNeural",
  "ace": "en-US-GuyNeural",
  "bug": "en-US-GuyNeural",
  "ban": "en-US-GuyNeural",
  "bjn": "en-US-GuyNeural",
  "mak": "en-US-GuyNeural",
  "sas": "en-US-GuyNeural",
  "tet": "en-US-GuyNeural",
  "cha": "en-US-GuyNeural",
  "niu": "en-US-GuyNeural",
  "tvl": "en-US-GuyNeural",
  "gil": "en-US-GuyNeural",
  "mah": "en-US-GuyNeural",
  "pau": "en-US-GuyNeural",
  "wls": "en-US-GuyNeural",
  "rar": "en-US-GuyNeural",
  "hif": "en-US-GuyNeural",
} as const

export const testSeries: TestSeriesObject = {
  "complex-config-from-v020": {
    description: "Adds opacity to selection toolbar",
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
        defaultVoice: LEGACY_EDGE_TTS_FALLBACK_VOICE,
        languageVoices: { ...LEGACY_TTS_LANGUAGE_VOICES },
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
        opacity: 100,
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
        defaultVoice: LEGACY_EDGE_TTS_FALLBACK_VOICE,
        languageVoices: { ...LEGACY_TTS_LANGUAGE_VOICES },
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
        opacity: 100,
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
        defaultVoice: LEGACY_EDGE_TTS_FALLBACK_VOICE,
        languageVoices: { ...LEGACY_TTS_LANGUAGE_VOICES },
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
        opacity: 100,
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
        defaultVoice: LEGACY_EDGE_TTS_FALLBACK_VOICE,
        languageVoices: { ...LEGACY_TTS_LANGUAGE_VOICES },
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
        opacity: 100,
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
