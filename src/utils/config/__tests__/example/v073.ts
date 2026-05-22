import type { TestSeriesObject } from "./types"

const DEFAULT_BATCH_TRANSLATE_PROMPT = `## Multi-paragraph Translation Rules
1. If input contains %%, use %% in your output, if input has no %%, don't use %% in your output
2. **CRITICAL**: Preserve exact formatting around %% - use exactly one empty line before and after, with no extra spaces, tabs, or whitespace

## OUTPUT FORMAT:
- **Single paragraph input** → Output translation directly (no separators, no extra text)
- **Multi-paragraph input (input uses %% separators)** → Use %% as paragraph separator between translations

## Examples

### Multi-paragraph Input:
Paragraph A

%%

Paragraph B

%%

Paragraph C

### Multi-paragraph Output:
Translation A

%%

Translation B

%%

Translation C

### Single paragraph Input:
Single paragraph content

### Single paragraph Output:
Direct translation without separators
`

export const testSeries: TestSeriesObject = {
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
          shortcut: "Alt+B",
          preload: {
            margin: 1000,
            threshold: 0,
          },
          minCharactersPerNode: 0,
          minWordsPerNode: 0,
          enableTargetLanguageSkip: true,
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
              batchSystemPrompt: DEFAULT_BATCH_TRANSLATE_PROMPT,
              appendBatchSystemPrompt: true,
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
        defaultVoice: "en-US-GuyNeural",
        languageVoices: {
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
        },
        rate: 0,
        pitch: 0,
        volume: 0,
      },
      floatingButton: {
        enabled: true,
        position: 0.5,
        disabledFloatingButtonPatterns: [],
        clickAction: "panel",
        locked: false,
        side: "right",
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
              {
                id: "coverage-term",
                name: "Term",
                type: "string",
                description: "Focus on {{selection}}.",
                speaking: true,
              },
              {
                id: "coverage-definition",
                name: "Definition",
                type: "string",
                description: "Explain it in {{targetLanguage}}.",
                speaking: false,
              },
              {
                id: "coverage-context",
                name: "Context",
                type: "string",
                description: "Reuse {{paragraphs}} exactly.",
                speaking: true,
              },
              {
                id: "coverage-notes",
                name: "Notes",
                type: "string",
                description: "Mention {{webTitle}} when relevant.",
                speaking: false,
              },
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
              systemPrompt: "Translate subtitles into {{targetLanguage}} with {{videoTitle}} and {{videoSummary}} as context.",
              prompt: "Title: {{videoTitle}}\nSummary: {{videoSummary}}\nTranslate to {{targetLanguage}}:\n{{input}}",
              batchSystemPrompt: DEFAULT_BATCH_TRANSLATE_PROMPT,
              appendBatchSystemPrompt: true,
            },
          ],
        },
        position: {
          percent: 10,
          anchor: "bottom",
        },
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
