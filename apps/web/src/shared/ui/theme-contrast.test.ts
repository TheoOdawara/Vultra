import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");

const TEXT_ON_SURFACE = [
  ["foreground", "background"],
  ["foreground", "surface"],
  ["muted", "background"],
  ["muted", "surface"],
  ["primary", "background"],
  ["primary", "surface"],
  ["primary-foreground", "primary"],
  ["success", "background"],
  ["success", "surface"],
  ["warning", "background"],
  ["warning", "surface"],
  ["danger", "background"],
  ["danger", "surface"],
] as const;

function blockOf(selector: string): string {
  const start = CSS.indexOf(selector);
  expect(start, `${selector} is declared`).toBeGreaterThan(-1);
  const open = CSS.indexOf("{", start);
  const close = CSS.indexOf("}", open);
  return CSS.slice(open, close);
}

function tokensOf(selector: string): Record<string, string> {
  const block = blockOf(selector);
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/g)) {
    if (name !== undefined && value !== undefined) tokens[name] = value;
  }
  return tokens;
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
  );
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

describe.each([
  ["light", ":root {"],
  ["dark", ':root[data-theme="dark"] {'],
])("%s theme", (_name, selector) => {
  const tokens = tokensOf(selector);

  it("declares every color token", () => {
    const declared = new Set(Object.keys(tokens));
    for (const pair of TEXT_ON_SURFACE) {
      for (const token of pair) expect(declared).toContain(token);
    }
  });

  it.each(TEXT_ON_SURFACE)("puts %s on %s above 4.5:1", (text, surface) => {
    const foreground = tokens[text];
    const background = tokens[surface];
    if (foreground === undefined || background === undefined) throw new Error("missing token");

    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the media-query theme", () => {
  it("matches the explicit dark theme token for token", () => {
    const explicit = tokensOf(':root[data-theme="dark"] {');
    const bySystem = tokensOf(':root:not([data-theme="light"]) {');

    expect(bySystem).toEqual(explicit);
  });

  it("yields to an explicit light choice", () => {
    expect(CSS).toContain(':root:not([data-theme="light"])');
  });
});
