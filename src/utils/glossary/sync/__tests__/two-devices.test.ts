import type { SyncedGlossary, SyncedTerm } from "../document"
import type { GlossarySnapshot } from "../merge-document"
import { describe, expect, it } from "vitest"
import { formatGlossaryDocument, parseGlossaryDocument } from "../document"
import { mergeGlossaryDocuments } from "../merge-document"

/**
 * Two devices and a cloud, wired exactly the way the orchestrator wires them.
 *
 * The merge is a pure function, so the only way to find out whether it actually
 * SYNCS anything is to run the loop it sits in: edit, sync, edit on the other
 * side, sync back. Every property below is one that a merge can satisfy on a
 * single call and still get wrong over two rounds.
 *
 * The document is serialised and re-parsed on every hop, so a field that cannot
 * survive JSON fails here rather than on a user's second machine.
 */
class Cloud {
  content: string | null = null

  read(): { glossaries: SyncedGlossary[]; terms: SyncedTerm[] } | null {
    if (this.content === null) return null
    const parsed = parseGlossaryDocument(this.content)
    if (!parsed.ok) throw new Error(`cloud holds an unreadable document: ${parsed.reason}`)
    return { glossaries: parsed.document.glossaries, terms: parsed.document.terms }
  }

  write(payload: { glossaries: readonly SyncedGlossary[]; terms: readonly SyncedTerm[] }): void {
    this.content = formatGlossaryDocument(payload)
  }
}

type SyncOutcome = "uploaded" | "merged" | "no-change"

class Device {
  glossaries: SyncedGlossary[] = []
  terms: SyncedTerm[] = []
  /** Null until this device has agreed with the cloud once. */
  base: GlossarySnapshot | null = null

  constructor(readonly name: string) {}

  sync(cloud: Cloud): SyncOutcome {
    const remote = cloud.read()

    // An absent file is not an empty glossary: upload, delete nothing.
    if (remote === null) {
      cloud.write({ glossaries: this.glossaries, terms: this.terms })
      this.base = this.snapshot()
      return "uploaded"
    }

    const result = mergeGlossaryDocuments({
      base: this.base ?? { glossaries: [], terms: [] },
      local: this.snapshot(),
      remote,
    })
    if (!result.ok) throw new Error(`merge refused: ${result.reason}`)

    const { stats } = result.merge
    const moved =
      stats.glossaries.incoming +
      stats.glossaries.outgoing +
      stats.glossaries.removed +
      stats.terms.incoming +
      stats.terms.outgoing +
      stats.terms.removed
    if (moved === 0) return "no-change"

    // Upload first, then adopt. Base is what was uploaded, never a re-read.
    cloud.write({ glossaries: result.merge.glossaries, terms: result.merge.terms })
    this.glossaries = result.merge.glossaries
    this.terms = result.merge.terms
    this.base = this.snapshot()
    return "merged"
  }

  /**
   * Deep, not a shallow array copy. `base` is a separate row in Dexie, so an
   * edit to a live term cannot reach into it — a harness that let the two share
   * objects would show every edit as already-synced and quietly prove nothing.
   */
  snapshot(): GlossarySnapshot {
    return {
      glossaries: this.glossaries.map((row) => ({ ...row, matchPatterns: [...row.matchPatterns] })),
      terms: this.terms.map((row) => ({ ...row })),
    }
  }

  addGlossary(id: string, name = id): void {
    this.glossaries.push({
      id,
      name,
      description: "",
      enabled: true,
      matchPatterns: [],
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })
  }

  addTerm(glossaryId: string, source: string, target: string, at = "2026-02-01"): void {
    this.terms.push({
      id: `${this.name}-${source}`,
      glossaryId,
      matchKey: `i:${source.toLowerCase()}`,
      targetLang: "cmn",
      source,
      target,
      caseSensitive: false,
      enabled: true,
      updatedAt: new Date(`${at}T00:00:00.000Z`),
    })
  }

  editTerm(source: string, target: string, at: string): void {
    const term = this.terms.find((row) => row.source === source)
    if (!term) throw new Error(`${this.name} has no term ${source}`)
    term.target = target
    term.updatedAt = new Date(`${at}T00:00:00.000Z`)
  }

  deleteTerm(source: string): void {
    this.terms = this.terms.filter((row) => row.source !== source)
  }

  deleteGlossary(id: string): void {
    this.glossaries = this.glossaries.filter((row) => row.id !== id)
    this.terms = this.terms.filter((row) => row.glossaryId !== id)
  }

  /** Everything that has to agree between two devices, in a stable order. */
  state(): string[] {
    return [
      ...this.glossaries.map((g) => `glossary ${g.id} ${g.name} ${g.enabled}`),
      ...this.terms.map((t) => `term ${t.glossaryId}/${t.source}=>${t.target} ${t.enabled}`),
    ].sort()
  }
}

function converge(a: Device, b: Device, cloud: Cloud): void {
  // One round is not enough to prove anything: the second device has to send
  // back what it merged, and the first has to take it.
  a.sync(cloud)
  b.sync(cloud)
  a.sync(cloud)
}

describe("two devices and a cloud", () => {
  it("ends in the same state on both, after edits on each", () => {
    const cloud = new Cloud()
    const laptop = new Device("laptop")
    const desktop = new Device("desktop")

    laptop.addGlossary("work")
    laptop.addTerm("work", "React", "反应")
    laptop.sync(cloud)

    desktop.sync(cloud)
    desktop.addTerm("work", "Go", "围棋")
    laptop.addTerm("work", "Rust", "锈")

    converge(laptop, desktop, cloud)

    expect(laptop.state()).toEqual(desktop.state())
    expect(laptop.state()).toEqual([
      "glossary work work true",
      "term work/Go=>围棋 true",
      "term work/React=>反应 true",
      "term work/Rust=>锈 true",
    ])
  })

  it("does nothing on a second sync with nothing in between", () => {
    const cloud = new Cloud()
    const laptop = new Device("laptop")
    laptop.addGlossary("work")
    laptop.addTerm("work", "React", "反应")

    expect(laptop.sync(cloud)).toBe("uploaded")
    expect(laptop.sync(cloud)).toBe("no-change")
    expect(laptop.sync(cloud)).toBe("no-change")
  })

  /**
   * The property a sync without a merge base cannot have. The laptop's base says
   * it once agreed the term existed; the cloud no longer has it; therefore the
   * desktop deleted it, and the laptop must too — rather than helpfully putting
   * it back on every device, forever.
   */
  it("propagates a delete instead of resurrecting the row", () => {
    const cloud = new Cloud()
    const laptop = new Device("laptop")
    const desktop = new Device("desktop")

    laptop.addGlossary("work")
    laptop.addTerm("work", "React", "反应")
    laptop.addTerm("work", "Go", "围棋")
    laptop.sync(cloud)
    desktop.sync(cloud)

    desktop.deleteTerm("React")
    converge(desktop, laptop, cloud)

    expect(laptop.state()).toEqual(desktop.state())
    expect(laptop.terms.map((t) => t.source)).toEqual(["Go"])
  })

  it("keeps a delete deleted across a third round", () => {
    const cloud = new Cloud()
    const laptop = new Device("laptop")
    const desktop = new Device("desktop")
    laptop.addGlossary("work")
    laptop.addTerm("work", "React", "反应")
    laptop.sync(cloud)
    desktop.sync(cloud)

    laptop.deleteTerm("React")
    converge(laptop, desktop, cloud)
    desktop.sync(cloud)
    laptop.sync(cloud)

    expect(laptop.terms).toEqual([])
    expect(desktop.terms).toEqual([])
  })

  /**
   * Every user's first sync. Two glossaries that were never the same glossary
   * stay two, and the terms typed on both machines collapse to one row each
   * rather than to a pair the matcher would then choose between at random.
   */
  it("unions two independently built glossaries on the first sync", () => {
    const cloud = new Cloud()
    const laptop = new Device("laptop")
    const desktop = new Device("desktop")

    laptop.addGlossary("laptop-uuid", "Work")
    laptop.addTerm("laptop-uuid", "React", "反应")

    desktop.addGlossary("desktop-uuid", "Work")
    desktop.addTerm("desktop-uuid", "Go", "围棋")

    converge(laptop, desktop, cloud)

    expect(laptop.state()).toEqual(desktop.state())
    expect(laptop.glossaries).toHaveLength(2)
    expect(laptop.terms).toHaveLength(2)
  })

  it("collapses the same term typed on both machines into one row", () => {
    const cloud = new Cloud()
    const laptop = new Device("laptop")
    const desktop = new Device("desktop")

    laptop.addGlossary("work")
    laptop.addTerm("work", "token", "令牌")
    laptop.sync(cloud)

    // The desktop has never synced, so it typed its own copy with its own uuid.
    desktop.addGlossary("work")
    desktop.addTerm("work", "token", "令牌")

    converge(desktop, laptop, cloud)

    expect(laptop.state()).toEqual(desktop.state())
    expect(laptop.terms).toHaveLength(1)
  })

  it("converges on the same winner when both machines reworded one term", () => {
    const cloud = new Cloud()
    const laptop = new Device("laptop")
    const desktop = new Device("desktop")

    laptop.addGlossary("work")
    laptop.addTerm("work", "token", "令牌")
    laptop.sync(cloud)
    desktop.sync(cloud)

    laptop.editTerm("token", "凭证", "2026-03-01")
    desktop.editTerm("token", "代币", "2026-04-01")

    converge(laptop, desktop, cloud)

    expect(laptop.state()).toEqual(desktop.state())
    expect(laptop.terms[0]?.target).toBe("代币")
  })

  /** The same two edits, synced in the other order, must land on the same row. */
  it("converges to the same winner whichever device syncs first", () => {
    const build = () => {
      const cloud = new Cloud()
      const a = new Device("a")
      const b = new Device("b")
      a.addGlossary("work")
      a.addTerm("work", "token", "令牌")
      a.sync(cloud)
      b.sync(cloud)
      a.editTerm("token", "凭证", "2026-03-01")
      b.editTerm("token", "代币", "2026-04-01")
      return { cloud, a, b }
    }

    const first = build()
    converge(first.a, first.b, first.cloud)

    const second = build()
    converge(second.b, second.a, second.cloud)

    expect(first.a.state()).toEqual(second.a.state())
  })

  /**
   * Same wording, same millisecond — a CSV import stamps hundreds of rows that
   * way. Without a tie-break the two devices pick different winners and hand
   * each other the file back forever.
   */
  it("converges when two edits carry the identical timestamp", () => {
    const cloud = new Cloud()
    const laptop = new Device("laptop")
    const desktop = new Device("desktop")

    laptop.addGlossary("work")
    laptop.addTerm("work", "token", "令牌")
    laptop.sync(cloud)
    desktop.sync(cloud)

    laptop.editTerm("token", "凭证", "2026-03-01")
    desktop.editTerm("token", "代币", "2026-03-01")

    converge(laptop, desktop, cloud)
    expect(laptop.state()).toEqual(desktop.state())

    // And it stays put: a fourth and fifth round must not flip it back.
    desktop.sync(cloud)
    laptop.sync(cloud)
    expect(laptop.sync(cloud)).toBe("no-change")
    expect(desktop.sync(cloud)).toBe("no-change")
  })

  it("carries a deleted glossary, and its terms, to the other device", () => {
    const cloud = new Cloud()
    const laptop = new Device("laptop")
    const desktop = new Device("desktop")

    laptop.addGlossary("work")
    laptop.addTerm("work", "React", "反应")
    laptop.addTerm("work", "Go", "围棋")
    laptop.sync(cloud)
    desktop.sync(cloud)

    laptop.deleteGlossary("work")
    converge(laptop, desktop, cloud)

    expect(desktop.glossaries).toEqual([])
    expect(desktop.terms).toEqual([])
  })

  /**
   * The one case where a delete does not win. The desktop was editing a term in
   * the glossary the laptop deleted, so the glossary comes back whole — with the
   * terms nobody touched, not just the edited one, which is what stops the
   * survivors from becoming rows no screen can reach.
   */
  it("brings a deleted glossary back whole when the other device was editing it", () => {
    const cloud = new Cloud()
    const laptop = new Device("laptop")
    const desktop = new Device("desktop")

    laptop.addGlossary("work")
    laptop.addTerm("work", "React", "反应")
    laptop.addTerm("work", "Go", "围棋")
    laptop.sync(cloud)
    desktop.sync(cloud)

    desktop.editTerm("React", "反应堆", "2026-05-01")
    laptop.deleteGlossary("work")

    converge(desktop, laptop, cloud)

    expect(laptop.state()).toEqual(desktop.state())
    expect(laptop.glossaries.map((g) => g.id)).toEqual(["work"])
    expect(laptop.terms.map((t) => `${t.source}=>${t.target}`).sort()).toEqual([
      "Go=>围棋",
      "React=>反应堆",
    ])
  })

  it("never leaves a term whose glossary is gone", () => {
    const cloud = new Cloud()
    const laptop = new Device("laptop")
    const desktop = new Device("desktop")

    laptop.addGlossary("work")
    laptop.addTerm("work", "React", "反应")
    laptop.sync(cloud)
    desktop.sync(cloud)

    desktop.deleteGlossary("work")
    laptop.addTerm("work", "Go", "围棋")

    converge(laptop, desktop, cloud)

    const ids = new Set(laptop.glossaries.map((g) => g.id))
    expect(laptop.terms.every((t) => ids.has(t.glossaryId))).toBe(true)
    expect(laptop.state()).toEqual(desktop.state())
  })

  /** A third machine that has been offline the whole time must not undo any of it. */
  it("brings a device that was away for the whole story to the same place", () => {
    const cloud = new Cloud()
    const laptop = new Device("laptop")
    const desktop = new Device("desktop")
    const tablet = new Device("tablet")

    laptop.addGlossary("work")
    laptop.addTerm("work", "React", "反应")
    laptop.addTerm("work", "Go", "围棋")
    laptop.sync(cloud)
    tablet.sync(cloud)

    desktop.sync(cloud)
    desktop.deleteTerm("React")
    desktop.addTerm("work", "Rust", "锈")
    converge(desktop, laptop, cloud)

    tablet.sync(cloud)
    tablet.sync(cloud)

    expect(tablet.state()).toEqual(laptop.state())
    expect(tablet.terms.map((t) => t.source).sort()).toEqual(["Go", "Rust"])
  })
})
