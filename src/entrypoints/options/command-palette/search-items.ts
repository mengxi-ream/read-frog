import type { GeneratedI18nStructure } from "#i18n"

type I18nKey = keyof GeneratedI18nStructure

export interface SearchItem {
  sectionId: string
  route: string
  titleKey: string
  descriptionKey?: string
  pageKey: string
}

type SearchItemDefinition = Omit<SearchItem, "titleKey" | "descriptionKey" | "pageKey"> & {
  titleKey: I18nKey
  descriptionKey?: I18nKey
  pageKey: I18nKey
}

const TTS_SEARCH_ITEMS: SearchItemDefinition[] = [
  {
    sectionId: "tts-config",
    route: "/tts",
    titleKey: "options.tts.title",
    descriptionKey: "options.tts.description",
    pageKey: "options.tts.title",
  },
]

export const SEARCH_ITEMS: SearchItem[] = [
  // Preference page
  {
    // Titled with the section, so "appearance" still finds a row that reads "Theme".
    sectionId: "theme",
    route: "/preference",
    titleKey: "options.preference.appearanceAndLanguage.title",
    descriptionKey: "options.preference.appearanceAndLanguage.theme.description",
    pageKey: "options.preference.title",
  },
  {
    sectionId: "interface-language",
    route: "/preference",
    titleKey: "options.preference.appearanceAndLanguage.interfaceLanguage.title",
    descriptionKey: "options.preference.appearanceAndLanguage.interfaceLanguage.description",
    pageKey: "options.preference.title",
  },
  {
    sectionId: "site-control-mode",
    route: "/preference",
    titleKey: "options.preference.extensionActivation.mode.title",
    descriptionKey: "options.preference.extensionActivation.mode.description",
    pageKey: "options.preference.title",
  },
  {
    sectionId: "google-drive-sync",
    route: "/preference",
    titleKey: "options.preference.config.googleDrive.title",
    descriptionKey: "options.preference.config.googleDrive.description",
    pageKey: "options.preference.title",
  },
  {
    sectionId: "manual-config-sync",
    route: "/preference",
    titleKey: "options.preference.config.manualSync.title",
    descriptionKey: "options.preference.config.manualSync.description",
    pageKey: "options.preference.title",
  },
  {
    // Its own page, drilled into from the Preference page's Config section.
    sectionId: "config-backup",
    route: "/preference/config-backup",
    titleKey: "options.preference.config.backup.title",
    descriptionKey: "options.preference.config.backup.description",
    pageKey: "options.preference.title",
  },
  {
    sectionId: "reset-config",
    route: "/preference",
    titleKey: "options.preference.config.reset.title",
    descriptionKey: "options.preference.config.reset.description",
    pageKey: "options.preference.title",
  },
  {
    sectionId: "beta-experience",
    route: "/preference",
    titleKey: "options.preference.userExperience.beta.title",
    descriptionKey: "options.preference.userExperience.beta.description",
    pageKey: "options.preference.title",
  },
  {
    sectionId: "analytics",
    route: "/preference",
    titleKey: "options.preference.userExperience.analytics.title",
    descriptionKey: "options.preference.userExperience.analytics.description",
    pageKey: "options.preference.title",
  },

  // Shortcuts page
  {
    sectionId: "page-translation-shortcut",
    route: "/shortcuts",
    titleKey: "options.shortcuts.pageTranslation.title",
    descriptionKey: "options.shortcuts.pageTranslation.description",
    pageKey: "options.shortcuts.title",
  },
  {
    sectionId: "translation-mode-shortcut",
    route: "/shortcuts",
    titleKey: "options.shortcuts.translationMode.title",
    descriptionKey: "options.shortcuts.translationMode.description",
    pageKey: "options.shortcuts.title",
  },
  {
    sectionId: "selection-translation-shortcut",
    route: "/shortcuts",
    titleKey: "options.shortcuts.selectionTranslation.title",
    descriptionKey: "options.shortcuts.selectionTranslation.description",
    pageKey: "options.shortcuts.title",
  },
  {
    sectionId: "node-translation-hotkey",
    route: "/shortcuts",
    titleKey: "options.shortcuts.nodeTranslation.title",
    descriptionKey: "options.shortcuts.nodeTranslation.description",
    pageKey: "options.shortcuts.title",
  },

  // API Providers page
  {
    sectionId: "provider-config",
    route: "/api-providers",
    titleKey: "options.apiProviders.configTitle",
    descriptionKey: "options.apiProviders.description",
    pageKey: "options.apiProviders.title",
  },
  {
    sectionId: "feature-providers",
    route: "/api-providers",
    titleKey: "options.apiProviders.featureProviders.title",
    descriptionKey: "options.apiProviders.featureProviders.description",
    pageKey: "options.apiProviders.title",
  },
  {
    sectionId: "language-detection",
    route: "/api-providers",
    titleKey: "options.apiProviders.languageDetection.title",
    descriptionKey: "options.apiProviders.languageDetection.description",
    pageKey: "options.apiProviders.title",
  },
  {
    sectionId: "ai-content-aware",
    route: "/api-providers",
    titleKey: "options.apiProviders.aiContentAware.title",
    descriptionKey: "options.apiProviders.aiContentAware.description",
    pageKey: "options.apiProviders.title",
  },

  // Custom Actions page
  {
    sectionId: "custom-actions",
    route: "/custom-actions",
    titleKey: "options.floatingButtonAndToolbar.selectionToolbar.customActions.title",
    descriptionKey: "options.floatingButtonAndToolbar.selectionToolbar.customActions.description",
    pageKey: "options.floatingButtonAndToolbar.selectionToolbar.customActions.title",
  },

  // Translation page
  {
    sectionId: "translation-mode",
    route: "/page-translation",
    titleKey: "options.translation.translationMode.title",
    descriptionKey: "options.translation.translationMode.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "translate-range",
    route: "/page-translation",
    titleKey: "options.translation.translateRange.title",
    descriptionKey: "options.translation.translateRange.description",
    pageKey: "options.translation.title",
  },
  {
    // Titled with the section, so the row that reads "Enable" is still findable on its own.
    sectionId: "hover-translation",
    route: "/page-translation",
    titleKey: "options.translation.hoverTranslation.title",
    descriptionKey: "options.translation.hoverTranslation.enable.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "translation-style",
    route: "/page-translation",
    titleKey: "options.translation.translationStyle.title",
    descriptionKey: "options.translation.translationStyle.description",
    pageKey: "options.translation.title",
  },
  {
    // Its own page, drilled into from the Translation Display Style section.
    sectionId: "custom-css",
    route: "/page-translation/custom-css",
    titleKey: "options.translation.translationStyle.cssEditor",
    descriptionKey: "options.translation.translationStyle.cssEditorDescription",
    pageKey: "options.translation.title",
  },
  {
    // Its own page, drilled into from the Translation page's Personalized Prompts section.
    sectionId: "personalized-prompts",
    route: "/page-translation/prompts",
    titleKey: "options.translation.personalizedPrompts.title",
    descriptionKey: "options.translation.personalizedPrompts.description",
    pageKey: "options.translation.title",
  },
  {
    // Its own page, drilled into from the Translate control section.
    sectionId: "auto-translate-website",
    route: "/page-translation/auto-translate-websites",
    titleKey: "options.translation.autoTranslateWebsite.title",
    descriptionKey: "options.translation.autoTranslateWebsite.description",
    pageKey: "options.translation.title",
  },
  {
    // Its own page, drilled into from the Translate control section.
    sectionId: "never-auto-translate-website",
    route: "/page-translation/never-auto-translate-websites",
    titleKey: "options.translation.neverAutoTranslateWebsite.title",
    descriptionKey: "options.translation.neverAutoTranslateWebsite.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "auto-translate-languages",
    route: "/page-translation",
    titleKey: "options.translation.autoTranslateLanguages.title",
    descriptionKey: "options.translation.autoTranslateLanguages.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "skip-languages",
    route: "/page-translation",
    titleKey: "options.translation.skipLanguages.title",
    descriptionKey: "options.translation.skipLanguages.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "request-rate",
    route: "/page-translation",
    titleKey: "options.translation.requestQueueConfig.title",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "request-batch",
    route: "/page-translation",
    titleKey: "options.translation.batchQueueConfig.title",
    descriptionKey: "options.translation.batchQueueConfig.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "preload-config",
    route: "/page-translation",
    titleKey: "options.translation.preloadConfig.title",
    descriptionKey: "options.translation.preloadConfig.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "small-paragraph-filter",
    route: "/page-translation",
    titleKey: "options.translation.smallParagraphFilter.title",
    descriptionKey: "options.translation.smallParagraphFilter.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "clear-cache",
    route: "/page-translation",
    titleKey: "options.translation.clearCache.title",
    descriptionKey: "options.translation.clearCache.description",
    pageKey: "options.translation.title",
  },
  {
    // Its own page, drilled into from the Translate control section.
    sectionId: "site-rules-user-rules",
    route: "/page-translation/site-rules",
    titleKey: "options.siteRules.userRules.title",
    descriptionKey: "options.siteRules.userRules.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "site-rules-built-in",
    route: "/page-translation/site-rules",
    titleKey: "options.siteRules.builtIn.title",
    descriptionKey: "options.siteRules.builtIn.description",
    pageKey: "options.translation.title",
  },

  // Floating Button page
  {
    sectionId: "floating-button-toggle",
    route: "/floating-button",
    titleKey: "options.floatingButtonAndToolbar.floatingButton.globalToggle.title",
    descriptionKey: "options.floatingButtonAndToolbar.floatingButton.globalToggle.description",
    pageKey: "options.overlayTools.floatingButton.title",
  },
  {
    sectionId: "floating-button-click-action",
    route: "/floating-button",
    titleKey: "options.floatingButtonAndToolbar.floatingButton.clickAction.title",
    descriptionKey: "options.floatingButtonAndToolbar.floatingButton.clickAction.description",
    pageKey: "options.overlayTools.floatingButton.title",
  },
  {
    sectionId: "floating-button-disabled-sites",
    route: "/floating-button",
    titleKey: "options.floatingButtonAndToolbar.floatingButton.disabledSites.title",
    descriptionKey: "options.floatingButtonAndToolbar.floatingButton.disabledSites.description",
    pageKey: "options.overlayTools.floatingButton.title",
  },

  // Selection Toolbar page
  {
    sectionId: "selection-toolbar-toggle",
    route: "/selection-toolbar",
    titleKey: "options.floatingButtonAndToolbar.selectionToolbar.globalToggle.title",
    descriptionKey: "options.floatingButtonAndToolbar.selectionToolbar.globalToggle.description",
    pageKey: "options.overlayTools.selectionToolbar.title",
  },
  {
    sectionId: "selection-toolbar-opacity",
    route: "/selection-toolbar",
    titleKey: "options.floatingButtonAndToolbar.selectionToolbar.opacity.title",
    descriptionKey: "options.floatingButtonAndToolbar.selectionToolbar.opacity.description",
    pageKey: "options.overlayTools.selectionToolbar.title",
  },
  {
    sectionId: "selection-toolbar-disabled-sites",
    route: "/selection-toolbar",
    titleKey: "options.floatingButtonAndToolbar.selectionToolbar.disabledSites.title",
    descriptionKey: "options.floatingButtonAndToolbar.selectionToolbar.disabledSites.description",
    pageKey: "options.overlayTools.selectionToolbar.title",
  },

  // Context Menu page
  {
    sectionId: "context-menu-translate",
    route: "/context-menu",
    titleKey: "options.floatingButtonAndToolbar.contextMenu.translate.title",
    descriptionKey: "options.floatingButtonAndToolbar.contextMenu.translate.description",
    pageKey: "options.overlayTools.contextMenu.title",
  },

  // Input Translation page
  {
    sectionId: "input-translation-toggle",
    route: "/input-translation",
    titleKey: "options.inputTranslation.toggle.title",
    descriptionKey: "options.inputTranslation.toggle.description",
    pageKey: "options.overlayTools.inputTranslation.title",
  },
  {
    sectionId: "input-translation-threshold-section",
    route: "/input-translation",
    titleKey: "options.inputTranslation.threshold.title",
    descriptionKey: "options.inputTranslation.threshold.description",
    pageKey: "options.overlayTools.inputTranslation.title",
  },
  {
    sectionId: "input-translation-languages",
    route: "/input-translation",
    titleKey: "options.inputTranslation.languages.title",
    descriptionKey: "options.inputTranslation.languages.description",
    pageKey: "options.overlayTools.inputTranslation.title",
  },

  // Video Subtitles page
  {
    sectionId: "subtitles-config",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.title",
    descriptionKey: "options.videoSubtitles.description",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "subtitles-style",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.style.title",
    descriptionKey: "options.videoSubtitles.style.description",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "subtitles-custom-prompts",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.customPrompts.title",
    descriptionKey: "options.videoSubtitles.customPrompts.description",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "subtitles-request-rate",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.requestQueueConfig.title",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "subtitles-request-batch",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.batchQueueConfig.title",
    descriptionKey: "options.videoSubtitles.batchQueueConfig.description",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "clear-ai-segmentation-cache",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.aiSegmentation.clearCacheDialog.title",
    descriptionKey: "options.videoSubtitles.aiSegmentation.clearCacheDialog.description",
    pageKey: "options.videoSubtitles.title",
  },

  // Text to Speech page
  ...TTS_SEARCH_ITEMS,
] satisfies SearchItemDefinition[]
