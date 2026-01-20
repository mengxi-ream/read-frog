---
"read-frog": minor
---

feat(subtitles): add AI-powered intelligent sentence segmentation

- Add AI segmentation option for subtitle processing that uses LLM to intelligently segment sentences
- Implement IndexedDB caching for AI segmentation results with video ID and language-based keys
- Add background message handler for AI segmentation requests with streaming support
- Add config option `enableAiSegmentation` with migration from v48 to v49
- Add UI toggle in video subtitles settings page
- Add cache clearing functionality for AI segmentation cache
- Support 8 languages with localized strings (en, zh-CN, zh-TW, ja, ko, ru, tr, vi)
- Update block strategy to integrate AI segmentation when enabled
