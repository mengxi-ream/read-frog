---
"@read-frog/extension": patch
---

fix(hosted-ai): say when Built-in AI cannot run, and stop paying to ask

Built-in AI is in every feature's provider list whether or not your plan funds
it, and several places treated "a provider exists" as "a provider works". The
result was a set of failures with no symptom: video subtitles came back
untranslated and were recorded as done, input translation showed a spinner and
nothing else, and the Language detection card stayed green over a code path that
never ran once. Each of those now says which limit it hit, while still degrading
rather than breaking the page.

The same confusion drove the settings surfaces. Provider dropdowns, the
Language detection and AI-context cards, the popup's provider avatars and the
Built-in AI editor now share one rule for whether an option can actually run —
read from the plan and sign-in state alone, so an exhausted quota or a passing
outage no longer greys out an option you own, and a plan wall no longer reads as
healthy. Deleting a provider is refused when it would leave a feature with
nothing that can run it, naming the feature rather than saying "at least one LLM
provider is required".

Skip-language detection no longer uses an LLM. It runs once per paragraph, so a
long article meant hundreds of billed calls to avoid the occasional redundant
translation; franc answers the same question for free. Language detection mode
still governs the once-per-page source detection, where a wrong answer would
affect every paragraph.

Also: the hosted availability check is fetched once and shared instead of per
paragraph, per cue batch and per selection; original subtitles now appear
without waiting on it; the page-context warm-up covers Built-in AI, so the first
paragraph no longer pays for it; a video summary is no longer requested from a
provider that has no model to prompt; and hosted subtitle and input-translation
runs are no longer reported as provider "unknown" in usage analytics.
