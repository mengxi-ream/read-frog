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
    sectionId: "subtitles-toggle-shortcut",
    route: "/shortcuts",
    titleKey: "options.shortcuts.subtitlesToggle.title",
    descriptionKey: "options.shortcuts.subtitlesToggle.description",
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
    titleKey: "options.selectionToolbar.customActions.title",
    descriptionKey: "options.selectionToolbar.customActions.description",
    pageKey: "options.selectionToolbar.customActions.title",
  },

  // Translation page
  {
    sectionId: "translation-mode",
    route: "/page-translation",
    titleKey: "options.translation.preference.translationMode.title",
    descriptionKey: "options.translation.preference.translationMode.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "translate-range",
    route: "/page-translation",
    titleKey: "options.translation.preference.translateRange.title",
    descriptionKey: "options.translation.preference.translateRange.description",
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
    // Its own page, drilled into from the Translation control section.
    sectionId: "auto-translate-website",
    route: "/page-translation/auto-translate-websites",
    titleKey: "options.translation.translationControl.autoTranslateWebsite.title",
    descriptionKey: "options.translation.translationControl.autoTranslateWebsite.description",
    pageKey: "options.translation.title",
  },
  {
    // Its own page, drilled into from the Translation control section.
    sectionId: "never-auto-translate-website",
    route: "/page-translation/never-auto-translate-websites",
    titleKey: "options.translation.translationControl.neverAutoTranslateWebsite.title",
    descriptionKey: "options.translation.translationControl.neverAutoTranslateWebsite.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "auto-translate-languages",
    route: "/page-translation",
    titleKey: "options.translation.translationControl.autoTranslateLanguages.title",
    descriptionKey: "options.translation.translationControl.autoTranslateLanguages.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "skip-languages",
    route: "/page-translation",
    titleKey: "options.translation.translationControl.skipLanguages.title",
    descriptionKey: "options.translation.translationControl.skipLanguages.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "request-rate",
    route: "/page-translation",
    titleKey: "options.translation.translationQueue.requestQueueConfig.title",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "request-batch",
    route: "/page-translation",
    titleKey: "options.translation.translationQueue.batchQueueConfig.title",
    descriptionKey: "options.translation.translationQueue.batchQueueConfig.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "preload-config",
    route: "/page-translation",
    titleKey: "options.translation.translationQueue.preloadConfig.title",
    descriptionKey: "options.translation.translationQueue.preloadConfig.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "small-paragraph-filter",
    route: "/page-translation",
    titleKey: "options.translation.translationControl.smallParagraphFilter.title",
    descriptionKey: "options.translation.translationControl.smallParagraphFilter.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "clear-cache",
    route: "/page-translation",
    titleKey: "options.translation.cache.clearCache.title",
    descriptionKey: "options.translation.cache.clearCache.description",
    pageKey: "options.translation.title",
  },
  {
    // Its own page, drilled into from the Translation control section.
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
    titleKey: "options.floatingButton.enable.title",
    descriptionKey: "options.floatingButton.enable.description",
    pageKey: "options.floatingButton.title",
  },
  {
    sectionId: "floating-button-side",
    route: "/floating-button",
    titleKey: "options.floatingButton.display.side.title",
    descriptionKey: "options.floatingButton.display.side.description",
    pageKey: "options.floatingButton.title",
  },
  {
    sectionId: "floating-button-disabled-sites",
    route: "/floating-button",
    titleKey: "options.floatingButton.display.disabledSites.title",
    descriptionKey: "options.floatingButton.display.disabledSites.description",
    pageKey: "options.floatingButton.title",
  },
  {
    sectionId: "floating-button-click-action",
    route: "/floating-button",
    titleKey: "options.floatingButton.clickAction.title",
    descriptionKey: "options.floatingButton.clickAction.description",
    pageKey: "options.floatingButton.title",
  },

  // Selection Toolbar page
  {
    sectionId: "selection-toolbar-toggle",
    route: "/selection-toolbar",
    titleKey: "options.selectionToolbar.enable.title",
    descriptionKey: "options.selectionToolbar.enable.description",
    pageKey: "options.selectionToolbar.title",
  },
  {
    // Titled with the section, so "translate" and "speak" both find the rows that switch
    // them on without either row's one-word title standing alone in the results.
    sectionId: "selection-toolbar-actions",
    route: "/selection-toolbar",
    titleKey: "options.selectionToolbar.actions.title",
    descriptionKey: "options.selectionToolbar.actions.translate.description",
    pageKey: "options.selectionToolbar.title",
  },
  {
    sectionId: "selection-toolbar-save-suggestion",
    route: "/selection-toolbar",
    titleKey: "options.selectionToolbar.actions.saveSuggestion.title",
    descriptionKey: "options.selectionToolbar.actions.saveSuggestion.description",
    pageKey: "options.selectionToolbar.title",
  },
  {
    sectionId: "selection-toolbar-opacity",
    route: "/selection-toolbar",
    titleKey: "options.selectionToolbar.display.opacity.title",
    descriptionKey: "options.selectionToolbar.display.opacity.description",
    pageKey: "options.selectionToolbar.title",
  },
  {
    sectionId: "selection-toolbar-disabled-sites",
    route: "/selection-toolbar",
    titleKey: "options.selectionToolbar.display.disabledSites.title",
    descriptionKey: "options.selectionToolbar.display.disabledSites.description",
    pageKey: "options.selectionToolbar.title",
  },

  // Context Menu page
  {
    sectionId: "context-menu-translate",
    route: "/context-menu",
    titleKey: "options.contextMenu.enable.title",
    descriptionKey: "options.contextMenu.enable.description",
    pageKey: "options.contextMenu.title",
  },

  // Input Translation page
  {
    // Titled with the section, so the row that reads "Enable" is still findable on its own.
    sectionId: "input-translation-trigger",
    route: "/input-translation",
    titleKey: "options.inputTranslation.trigger.title",
    descriptionKey: "options.inputTranslation.trigger.enable.description",
    pageKey: "options.inputTranslation.title",
  },
  {
    sectionId: "input-translation-threshold",
    route: "/input-translation",
    titleKey: "options.inputTranslation.trigger.threshold.title",
    descriptionKey: "options.inputTranslation.trigger.threshold.description",
    pageKey: "options.inputTranslation.title",
  },
  {
    sectionId: "input-translation-languages",
    route: "/input-translation",
    titleKey: "options.inputTranslation.languages.title",
    descriptionKey: "options.inputTranslation.languages.pair.description",
    pageKey: "options.inputTranslation.title",
  },
  {
    sectionId: "input-translation-cycle",
    route: "/input-translation",
    titleKey: "options.inputTranslation.languages.cycle.title",
    descriptionKey: "options.inputTranslation.languages.cycle.description",
    pageKey: "options.inputTranslation.title",
  },

  // Video Subtitles page
  {
    sectionId: "subtitles-enable",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.preference.enable.title",
    descriptionKey: "options.videoSubtitles.preference.enable.description",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "subtitles-auto-start",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.preference.autoStart.title",
    descriptionKey: "options.videoSubtitles.preference.autoStart.description",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "subtitles-ai-segmentation",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.preference.aiSegmentation.title",
    descriptionKey: "options.videoSubtitles.preference.aiSegmentation.description",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "subtitles-ai-quota",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.aiQuota.title",
    descriptionKey: "options.videoSubtitles.aiQuota.description",
    pageKey: "options.videoSubtitles.title",
  },
  {
    // Its own page, drilled into from the Video Subtitles page's Subtitle style section.
    sectionId: "subtitles-style",
    route: "/video-subtitles/style",
    titleKey: "options.videoSubtitles.style.title",
    descriptionKey: "options.videoSubtitles.style.description",
    pageKey: "options.videoSubtitles.title",
  },
  {
    // Its own page, drilled into from the Video Subtitles page's Custom prompts section.
    sectionId: "subtitles-custom-prompts",
    route: "/video-subtitles/prompts",
    titleKey: "options.videoSubtitles.customPrompts.title",
    descriptionKey: "options.videoSubtitles.customPrompts.description",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "subtitles-request-rate",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.subtitlesQueue.requestQueueConfig.title",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "subtitles-request-batch",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.subtitlesQueue.batchQueueConfig.title",
    descriptionKey: "options.videoSubtitles.subtitlesQueue.batchQueueConfig.description",
    pageKey: "options.videoSubtitles.title",
  },
  {
    sectionId: "clear-ai-segmentation-cache",
    route: "/video-subtitles",
    titleKey: "options.videoSubtitles.cache.clearCache.title",
    descriptionKey: "options.videoSubtitles.cache.clearCache.description",
    pageKey: "options.videoSubtitles.title",
  },

  // Text to Speech page
  {
    sectionId: "language-voice",
    route: "/tts",
    titleKey: "options.tts.voice.language.title",
    descriptionKey: "options.tts.voice.language.description",
    pageKey: "options.tts.title",
  },
  {
    sectionId: "tts-voice",
    route: "/tts",
    titleKey: "options.tts.voice.fallback.title",
    descriptionKey: "options.tts.voice.fallback.description",
    pageKey: "options.tts.title",
  },
  {
    sectionId: "tts-rate",
    route: "/tts",
    titleKey: "options.tts.speech.rate.title",
    descriptionKey: "options.tts.speech.rate.description",
    pageKey: "options.tts.title",
  },
  {
    sectionId: "tts-pitch",
    route: "/tts",
    titleKey: "options.tts.speech.pitch.title",
    descriptionKey: "options.tts.speech.pitch.description",
    pageKey: "options.tts.title",
  },
  {
    sectionId: "tts-volume",
    route: "/tts",
    titleKey: "options.tts.speech.volume.title",
    descriptionKey: "options.tts.speech.volume.description",
    pageKey: "options.tts.title",
  },
] satisfies SearchItemDefinition[]
