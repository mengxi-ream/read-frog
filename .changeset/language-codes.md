---
"@read-frog/extension": patch
---

fix(languages): send each language to translation services under its own code. Cantonese is translated into Cantonese instead of Mandarin, Central Kurdish into Sorani instead of Kurmanji on Google, and Filipino works on Microsoft; 20 languages that failed on Google, and 6 on Microsoft, now translate. Malay translations run left to right, AI translation no longer asks for Malay in Arabic script or Azerbaijani, Uzbek and Bosnian in Cyrillic, and Albanian and Mongolian pages are recognized. Translations carry the language's full tag in their `lang` attribute (`zh-Hans`, `pt-BR`, `yue`) instead of a two-letter code, so custom CSS that matches `[lang="zh"]` should use `:lang(zh)`
