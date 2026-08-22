import { describe, expect, it } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// ADR-0001 §5: a migration outside the journal is a release blocker — the
// journal is what every migrated environment actually runs. The migration
// strategy is manual append-only SQL (see drizzle.config.ts), so nothing
// generated keeps these two in sync; this guard does.
const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations/", import.meta.url));

interface JournalEntry {
  idx: number;
  tag: string;
}

async function journalEntries(): Promise<JournalEntry[]> {
  const journal = (await Bun.file(join(MIGRATIONS_DIR, "meta", "_journal.json")).json()) as {
    entries: JournalEntry[];
  };
  return journal.entries;
}

function sqlFileTags(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => name.slice(0, -".sql".length))
    .sort();
}

describe("migration journal", () => {
  it("registers every .sql file on disk", async () => {
    const registered = new Set((await journalEntries()).map((entry) => entry.tag));
    const missing = sqlFileTags().filter((tag) => !registered.has(tag));

    expect(missing).toEqual([]);
  });

  it("has no entry without a matching .sql file", async () => {
    const onDisk = new Set(sqlFileTags());
    const orphaned = (await journalEntries())
      .map((entry) => entry.tag)
      .filter((tag) => !onDisk.has(tag));

    expect(orphaned).toEqual([]);
  });

  it("keeps entries contiguous and in file order", async () => {
    const entries = await journalEntries();

    expect(entries.map((entry) => entry.idx)).toEqual(entries.map((_, position) => position));
    expect(entries.map((entry) => entry.tag)).toEqual(sqlFileTags().slice(0, entries.length));
  });

  it("scans a directory that actually contains migrations", () => {
    expect(sqlFileTags().length).toBeGreaterThanOrEqual(16);
  });
});
