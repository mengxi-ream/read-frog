---
"@read-frog/extension": minor
---

feat(glossary): sync your glossaries across devices, and carry them in exports

Your glossaries now sync through Google Drive alongside your settings, in a file
of their own. They are merged rather than replaced: terms added on two machines
end up as one list, a term you edited on one and turned off on the other keeps
both changes, and deleting a term on one device removes it on the others instead
of having it come back on the next sync.

Where the two copies genuinely disagree — the same term reworded differently on
each machine — you are shown the two versions and pick. The first sync on a
device tells you what is coming and what is going before it touches anything, a
sync that would remove a large part of your list asks first, and any sync can be
undone from the toast it leaves behind. Each sync says what it did to this
device: how many terms were added, updated and removed.

Signing in with a different Google account tells you what is about to happen
before it happens: how many glossary rows this device is sending up to the new
account, and how to keep only that account's glossaries instead.

Exporting your settings to a file now includes your glossaries, and importing
such a file brings them back — so moving to a new machine, or taking a copy
before a reset, no longer leaves the terms you typed behind. Resetting your
config leaves your glossaries alone, and now says so.

**Importing a glossary CSV is stricter, and some files that used to work will
not.** The file must carry the four columns Export writes —
`source,target,targetLanguage,caseSensitive` — with every cell filled. A term's
case rule and target language are part of what identifies it, so a file that
leaves them out cannot say which rows it is describing; the import screen used
to guess with a checkbox and a language picker, which meant one file could land
two different ways. Those two controls are gone. Two-column files from other
tools, exports from before those columns existed, and a bare term on a line of
its own are refused now, with a message naming the columns. Export a glossary to
see the shape, or add the header and the two columns to an existing file.

The sidebar groups Page Translation, Video Subtitles and Input Translation under
one Translation entry, and Advanced moves to the bottom.
