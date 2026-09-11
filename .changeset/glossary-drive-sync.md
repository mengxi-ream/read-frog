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
undone from the toast it leaves behind.

Exporting your settings to a file now includes your glossaries, and importing
such a file brings them back — so moving to a new machine, or taking a copy
before a reset, no longer leaves the terms you typed behind.
