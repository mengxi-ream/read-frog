import type { GeneratedI18nStructure } from "#i18n"

type I18nKey = keyof GeneratedI18nStructure

export interface SearchItem {
  sectionId: string
  route: string
  titleKey: string
  descriptionKey?: string
  pageKey: string
}

const IS_FIREFOX = import.meta.env.BROWSER === "firefox"

type SearchItemDefinition = Omit<SearchItem, "titleKey" | "descriptionKey" | "pageKey"> & {
  titleKey: I18nKey
  descriptionKey?: I18nKey
  pageKey: I18nKey
}

const TTS_SEARCH_ITEMS: SearchItemDefinition[] = !IS_FIREFOX
  ? [{
      sectionId: "tts-config",
      route: "/tts",
      titleKey: "options.tts.title",
      descriptionKey: "options.tts.description",
      pageKey: "options.tts.title",
    }]
  : []

const CONFIG_SEARCH_ITEMS = [
  {
    sectionId: "beta-experience",
    route: "/config",
    titleKey: "options.betaExperience.title",
    descriptionKey: "options.betaExperience.description",
    pageKey: "options.config.title",
  },
  {
    sectionId: "google-drive-sync",
    route: "/config",
    titleKey: "options.config.sync.googleDrive.title",
    descriptionKey: "options.config.sync.googleDrive.description",
    pageKey: "options.config.title",
  },
  {
    sectionId: "manual-config-sync",
    route: "/config",
    titleKey: "options.config.sync.title",
    descriptionKey: "options.config.sync.description",
    pageKey: "options.config.title",
  },
  {
    sectionId: "config-backup",
    route: "/config",
    titleKey: "options.config.backup.title",
    descriptionKey: "options.config.backup.description",
    pageKey: "options.config.title",
  },
  {
    sectionId: "reset-config",
    route: "/config",
    titleKey: "options.config.resetConfig.title",
    descriptionKey: "options.config.resetConfig.description",
    pageKey: "options.config.title",
  },
] satisfies SearchItemDefinition[]

export const SEARCH_ITEMS: SearchItem[] = [
  // General page
  {
    sectionId: "feature-providers",
    route: "/",
    titleKey: "options.general.featureProviders.title",
    descriptionKey: "options.general.featureProviders.description",
    pageKey: "options.general.title",
  },
  {
    sectionId: "site-control-mode",
    route: "/",
    titleKey: "options.siteControl.mode.title",
    descriptionKey: "options.siteControl.mode.description",
    pageKey: "options.general.title",
  },
  {
    sectionId: "appearance",
    route: "/",
    titleKey: "options.general.appearance.title",
    descriptionKey: "options.general.appearance.theme",
    pageKey: "options.general.title",
  },

  // API Providers page
  {
    sectionId: "api-providers",
    route: "/api-providers",
    titleKey: "options.apiProviders.title",
    descriptionKey: "options.apiProviders.description",
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
    route: "/translation",
    titleKey: "options.translation.translationMode.title",
    descriptionKey: "options.translation.translationMode.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "translate-range",
    route: "/translation",
    titleKey: "options.translation.translateRange.title",
    descriptionKey: "options.translation.translateRange.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "page-translation-shortcut",
    route: "/translation",
    titleKey: "options.translation.pageTranslationShortcut.title",
    descriptionKey: "options.translation.pageTranslationShortcut.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "node-translation-hotkey",
    route: "/translation",
    titleKey: "options.translation.nodeTranslationHotkey.title",
    descriptionKey: "options.translation.nodeTranslationHotkey.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "custom-translation-style",
    route: "/translation",
    titleKey: "options.translation.translationStyle.title",
    descriptionKey: "options.translation.translationStyle.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "ai-content-aware",
    route: "/translation",
    titleKey: "options.translation.aiContentAware.title",
    descriptionKey: "options.translation.aiContentAware.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "personalized-prompts",
    route: "/translation",
    titleKey: "options.translation.personalizedPrompts.title",
    descriptionKey: "options.translation.personalizedPrompts.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "auto-translate-website",
    route: "/translation",
    titleKey: "options.translation.autoTranslateWebsite.title",
    descriptionKey: "options.translation.autoTranslateWebsite.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "auto-translate-languages",
    route: "/translation",
    titleKey: "options.translation.autoTranslateLanguages.title",
    descriptionKey: "options.translation.autoTranslateLanguages.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "skip-languages",
    route: "/translation",
    titleKey: "options.translation.skipLanguages.title",
    descriptionKey: "options.translation.skipLanguages.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "request-rate",
    route: "/translation",
    titleKey: "options.translation.requestQueueConfig.title",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "request-batch",
    route: "/translation",
    titleKey: "options.translation.batchQueueConfig.title",
    descriptionKey: "options.translation.batchQueueConfig.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "preload-config",
    route: "/translation",
    titleKey: "options.translation.preloadConfig.title",
    descriptionKey: "options.translation.preloadConfig.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "small-paragraph-filter",
    route: "/translation",
    titleKey: "options.translation.smallParagraphFilter.title",
    descriptionKey: "options.translation.smallParagraphFilter.description",
    pageKey: "options.translation.title",
  },
  {
    sectionId: "clear-cache",
    route: "/translation",
    titleKey: "options.general.clearCache.title",
    descriptionKey: "options.general.clearCache.description",
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

  // Config page
  ...CONFIG_SEARCH_ITEMS,
] satisfies SearchItemDefinition[]
