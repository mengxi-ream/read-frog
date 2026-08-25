---
"@read-frog/extension": patch
---

fix(translation): stop custom CSS from breaking the settings page it is previewed on

The custom CSS written for translated text was injected into the options page's own document to render the preview, so it styled the settings UI as well. A rule as ordinary as `* { display: none }` left the options page blank on every load — editor and sidebar included — with the CSS saved in config and no way back through the UI.

The preview now renders inside a same-origin frame, so the CSS reaches the sample text and nothing else. Because a frame is a document, everything the CSS could do on a real page it still does here — `:root` variables, `body` selectors, `@font-face` and `@property` all behave as they will in the wild, and the sample now inherits an ordinary page's 16px rather than the settings page's 14px.
