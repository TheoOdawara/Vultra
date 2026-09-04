import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

const TAILWIND_PALETTE =
  "white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

const RAW_UTILITY = new RegExp(
  `\\b(bg|text|border|ring|fill|stroke|outline|from|via|to|decoration|shadow|accent|caret|divide)-(${TAILWIND_PALETTE})(-[0-9]{2,3})?(\\/[0-9]+)?\\b`,
  "g"
);

const RAW_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/;

function sources(dir: string, extensions: string[]): { file: string; source: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path, extensions);
    if (!extensions.some((extension) => entry.name.endsWith(extension))) return [];
    return [
      { file: path.slice(SRC.length + 1).replace(/\\/g, "/"), source: readFileSync(path, "utf8") },
    ];
  });
}

describe("colour lives in tokens", () => {
  const code = sources(SRC, [".ts", ".tsx"]).filter(({ file }) => !file.includes(".test."));

  it("has sources to inspect", () => {
    expect(code.length).toBeGreaterThan(0);
  });

  it("writes no literal Tailwind palette utility", () => {
    const offenders = code.flatMap(({ file, source }) =>
      [...source.matchAll(RAW_UTILITY)].map((match) => `${file}: ${match[0]}`)
    );

    expect(offenders).toEqual([]);
  });

  it("writes no raw colour value outside globals.css", () => {
    const offenders = code.filter(({ source }) => RAW_LITERAL.test(source)).map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it("declares in globals.css every colour token the code uses", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const declared = new Set([...css.matchAll(/--color-([a-z-]+):/g)].map((match) => match[1]));

    const COLOUR_TOKEN =
      /\b(?:bg|text|border|ring|fill|stroke|outline|divide)-((?:primary|secondary|accent|card|popover|muted|destructive|sidebar)-foreground|background|surface|border|foreground|muted|primary|secondary|accent|card|popover|destructive|success|warning|danger|overlay|input|ring|sidebar|chart)(?:\/\d+)?\b/g;

    const used = new Set(
      code.flatMap(({ source }) => [...source.matchAll(COLOUR_TOKEN)].map((match) => match[1]))
    );

    expect([...used].filter((token) => token !== undefined && !declared.has(token))).toEqual([]);
  });
});

describe("the environment is read in one place", () => {
  it("keeps the runtime environment out of every file but the env module", () => {
    const reader = ["process", "env"].join(".");
    const offenders = sources(SRC, [".ts", ".tsx"])
      .filter(({ file }) => !file.includes(".test."))
      .filter(({ source }) => source.includes(reader))
      .map(({ file }) => file);

    expect(offenders).toEqual(["shared/env/env.ts"]);
  });
});
