import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Glob } from "bun";

// URL#pathname on Windows yields "/C:/…", which Glob.scan and Bun.file cannot open.
const PROJECT_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const ENVIRONMENT_MODULE_PREFIX = "src/shared/infra/env/";
const ENVIRONMENT_ACCESS = /\b(?:process|Bun)\.env\b/;

async function sourceFiles(): Promise<string[]> {
  const scanned = await Array.fromAsync(new Glob("src/**/*.ts").scan({ cwd: PROJECT_ROOT }));
  return [...scanned.map((path) => path.replaceAll("\\", "/")), "drizzle.config.ts"];
}

async function filesReadingEnvironmentDirectly(): Promise<string[]> {
  const offenders: string[] = [];

  for (const relativePath of await sourceFiles()) {
    if (relativePath.startsWith(ENVIRONMENT_MODULE_PREFIX)) {
      continue;
    }
    const contents = await Bun.file(join(PROJECT_ROOT, relativePath)).text();
    if (ENVIRONMENT_ACCESS.test(contents)) {
      offenders.push(relativePath);
    }
  }

  return offenders;
}

describe("environment access", () => {
  it("happens only inside the environment module", async () => {
    expect(await filesReadingEnvironmentDirectly()).toEqual([]);
  });

  it("scans a source tree that actually contains files", async () => {
    const scanned = await sourceFiles();

    expect(scanned.length).toBeGreaterThan(50);
    expect(scanned).toContain("drizzle.config.ts");
    expect(scanned).toContain("src/infrastructure/server.ts");
  });
});
