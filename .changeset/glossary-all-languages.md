---
"@read-frog/extension": patch
---

feat(glossary): let a term apply to every target language

A term with no translation means "leave this word alone", which is true whatever you are
translating into — but until now it had to be filed under one language, so it quietly
stopped working the moment you switched target language. Terms can now be set to **All
languages**, and that is what a term with an empty translation is set to by default.

Where both exist, a wording written for the language you are translating into wins over
the all-languages one, so a term can keep its original form everywhere except where you
have given it a rendering. Exports carry the setting and imports read it back.

The website list on a glossary now explains the difference between `*.example.com`, which
covers a site and its subdomains, and `example.com`, which matches only that exact address.
