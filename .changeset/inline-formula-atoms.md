---
"@read-frog/extension": patch
---

fix(translate): keep inline formulas in bilingual translations

Bilingual page translation flattened every paragraph to plain text, so
rendered formulas (native MathML on arXiv, KaTeX, MathJax, Wikipedia math)
vanished from the translated line or leaked as glyph soup, and no site rule
could bring them back. Formula elements are now "inline atoms": each is sent
to the provider as a `{{n}}` placeholder and a sanitized clone of the
original element is put back at the placeholder's translated position. A new
`atomSelectors` site-rule family (seeded for the common renderers) decides
what counts as an atom; paragraphs without atoms are unchanged.
