---
"@read-frog/extension": patch
---

feat(popup): ask for a store review once you have actually been using Read Frog

A small card now appears at the bottom of the popup offering to open the store's review
page, and it only shows up after you have successfully used a feature on three separate
days. Asking on engagement rather than on how long ago you installed means the question
only reaches people who have something to say, and a translation that failed never
counts toward it.

The card floats over the popup instead of sitting in the layout, so it never pushes the
controls around while you are reaching for them. Closing it, or going through to the
store, retires it for good — there is no second ask.

Rating from the More menu now also lands on the right store. Firefox users were being
sent to the Chrome Web Store, and Chrome and Firefox now open the reviews view directly
rather than the listing page.
