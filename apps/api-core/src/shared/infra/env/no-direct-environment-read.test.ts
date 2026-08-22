import { describe, expect, it } from "bun:test";
import { Glob } from "bun";

const PROJECT_ROOT = new URL("../../../../", import.meta.url).pathname;
const ENVIRONMENT_MODULE_PREFIX = "src/shared/infra/env/";
const ENVIRONMENT_ACCESS = /\b(?:process|Bun)\.env\b/;

async function sourceFiles(): Promise<string[]> {
  const scanned = await Array.fromAsync(new Glob("src/**/*.ts").scan({ cwd: PROJECT_ROOT }));
  return [...scanned, "drizzle.config.ts"];
}

async function filesReadingEnvironmentDirectly(): Promise<string[]> {
  const offenders: string[] = [];

  for (const relativePath of await sourceFiles()) {
    if (relativePath.startsWith(ENVIRONMENT_MODULE_PREFIX)) {
      continue;
    }
    const contents = await Bun.file(`${PROJECT_ROOT}${relativePath}`).text();
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
