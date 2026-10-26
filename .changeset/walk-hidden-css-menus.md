---
"@read-frog/extension": patch
---

fix(site-rules): translate header menus that open with pure CSS

Page translation skips content hidden with `display: none` or
`visibility: hidden` and only comes back to it when the site changes the DOM
to reveal it. Menus that open through CSS alone (`li:hover .dropdown`, or a
`:checked` checkbox) change nothing, so their content stayed untranslated,
like The North Face Korea's header dropdowns. A new `walkHiddenSelectors`
site-rule family names hidden regions the walk enters anyway; their content
translates when the menu opens, so closed menus cost nothing up front. The
North Face Korea ships with a built-in rule.
