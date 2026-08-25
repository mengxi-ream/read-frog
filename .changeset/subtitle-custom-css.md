---
"@read-frog/extension": patch
---

feat(subtitles): add custom CSS and preset templates to the subtitle style page

The subtitle style page could only set fonts, sizes, weights and colours, so effects like blurring the translation while training your listening had nowhere to live. A custom CSS row at the bottom of that page now opens an editor with the same live preview above it, plus a preset dropdown carrying three ready-made templates — blur translation, dashed translation, and dim original — that append into the editor so they can be stacked.

The picked font, size, weight and colour now reach the subtitle lines as CSS variables rather than inline styles, so custom CSS can override them without `!important`.

The preview renders in a shadow root, the same way the real overlay does, so the CSS being previewed reaches the preview and nothing else on the settings page.
