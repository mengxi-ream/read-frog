import type { SyncedGlossary, SyncedTerm } from "./document"
import type { GlossarySyncDocument } from "./document"
import { downloadFile, findFilesInAppData, uploadFile } from "@/utils/google-drive/api"
import { formatGlossaryDocument, GLOSSARY_SYNC_FILENAME, parseGlossaryDocument } from "./document"

/**
 * What the cloud had, in three states rather than two.
 *
 * The config sync returns `null` for both "there is no file" and "the file did
 * not parse", and for a merge that PROPAGATES DELETES those mean opposite
 * things. Read as an empty document, a file we failed to parse says every row in
 * the base was deleted remotely — which wipes the glossary on this device and
 * then uploads the wipe. It needs no corruption to happen either: Google removes
 * the whole appDataFolder when the user disconnects the app from their account.
 *
 * So `absent` means upload and delete nothing, ever; `unreadable` means stop.
 */
export type RemoteGlossaryRead =
  | { status: "ok"; document: GlossarySyncDocument; fileId: string; modifiedTime: string }
  | { status: "absent" }
  | { status: "unreadable"; reason: "malformed" | "version-too-new" | "duplicate-files" }

export async function readRemoteGlossary(): Promise<RemoteGlossaryRead> {
  const files = await findFilesInAppData(GLOSSARY_SYNC_FILENAME)
  if (files.length === 0) return { status: "absent" }
  if (files.length > 1) {
    // Two tabs that both found nothing both created one. Picking the first would
    // bind this device to one of them forever while another device used the
    // other, and the two would never see each other's terms. Surfaced, because
    // choosing which to delete is not a decision to make silently.
    return { status: "unreadable", reason: "duplicate-files" }
  }

  const file = files[0]!
  const parsed = parseGlossaryDocument(await downloadFile(file.id))
  if (!parsed.ok) return { status: "unreadable", reason: parsed.reason }

  return {
    status: "ok",
    document: parsed.document,
    fileId: file.id,
    modifiedTime: file.modifiedTime,
  }
}

export type RemoteGlossaryWrite = { ok: true } | { ok: false; reason: "changed-underneath" }

/**
 * Uploads the merged document.
 *
 * The PATCH underneath is unconditional, so the file's `modifiedTime` is read
 * again immediately before it: another device that uploaded in the meantime
 * would otherwise have its work erased, and — worse — this device would then
 * record those rows in its base as agreed, so its NEXT sync would read them as
 * deletions and remove them everywhere. Re-checking is not free of races, but it
 * closes the window from minutes to milliseconds, and the caller re-merges
 * rather than proceeding.
 *
 * `If-Match` is not used: Drive v3's support for it on this endpoint is not
 * something this codebase has verified.
 *
 * The `expected === null` branch is re-checked for the same reason, and it is
 * the one the cross-tab lock alone does not cover: whether a file exists is
 * decided in `planGlossarySync`, which runs BEFORE the lock is taken, so two
 * tabs can both plan against an empty Drive and only then serialise. Creating
 * unconditionally there gives the account two glossary files, which is a state
 * `readRemoteGlossary` refuses outright and the UI offers no way out of. Looking
 * again from inside the lock turns that into an ordinary re-merge.
 */
export async function writeRemoteGlossary(
  payload: { glossaries: readonly SyncedGlossary[]; terms: readonly SyncedTerm[] },
  expected: { fileId: string; modifiedTime: string } | null,
): Promise<RemoteGlossaryWrite> {
  const files = await findFilesInAppData(GLOSSARY_SYNC_FILENAME)

  if (expected) {
    const current = files.find((file) => file.id === expected.fileId)
    if (!current || files.length > 1 || current.modifiedTime !== expected.modifiedTime) {
      return { ok: false, reason: "changed-underneath" }
    }
  } else if (files.length > 0) {
    // Planned against an absent file, but one exists now. Uploading would make
    // a second; the caller re-plans against the file that appeared instead.
    return { ok: false, reason: "changed-underneath" }
  }

  await uploadFile(GLOSSARY_SYNC_FILENAME, formatGlossaryDocument(payload), expected?.fileId)
  return { ok: true }
}
