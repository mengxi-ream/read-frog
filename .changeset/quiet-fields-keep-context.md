---
"@read-frog/extension": patch
---

fix(selection-toolbar): use input and textarea values as AI action context

Text selected inside an `<input>` or `<textarea>` now uses the field's current value as its paragraph context instead of the page title and stylesheet text. For a textarea, only the paragraphs that contain the selection are used. Password field values are never read. Text inside `<head>`, `<style>`, `<script>`, `<noscript>` and `<title>` is no longer collected as page context.
