---
"@read-frog/extension": minor
---

feat(hosted-ai): run video subtitles, input translation, and language detection on Built-in AI

Built-in AI now covers video subtitles (translation, the video summary, and AI segmentation), input-box translation, language detection, and page translation's AI summary — everything that previously needed your own API key. Like page translation, these run on the Ultra plan; provider dropdowns mark and gray out what your account cannot run, and the Ultra badge opens the pricing page.

Language detection in particular could never offer Built-in AI before: its provider picker only listed providers stored in your own configuration, and the built-in ones are not stored there. Fixing that makes LLM detection mode available whenever an account can actually run it, and deleting your last API provider no longer silently drops language detection back to basic — if nothing left could run a feature, the deletion is refused and names the feature instead.
