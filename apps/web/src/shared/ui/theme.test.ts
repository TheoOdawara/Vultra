import { describe, expect, it } from "vitest";
import { applyTheme, isTheme, readStoredTheme, THEME_STORAGE_KEY } from "./theme";

function storage(value: string | null): Pick<Storage, "getItem"> {
  return { getItem: () => value };
}

describe("theme state", () => {
  it("keys the choice as vultra.theme", () => {
    expect(THEME_STORAGE_KEY).toBe("vultra.theme");
  });

  it("defaults to system with nothing stored", () => {
    expect(readStoredTheme(storage(null))).toBe("system");
  });

  it.each(["light", "dark", "system"])("reads back %s", (theme) => {
    expect(readStoredTheme(storage(theme))).toBe(theme);
  });

  it("falls back to system on a corrupted value", () => {
    expect(readStoredTheme(storage("solarized"))).toBe("system");
  });

  it("survives a storage that throws", () => {
    const denied: Pick<Storage, "getItem"> = {
      getItem: () => {
        throw new Error("access denied");
      },
    };

    expect(readStoredTheme(denied)).toBe("system");
  });

  it("rejects a value outside the three states", () => {
    expect(isTheme("auto")).toBe(false);
  });

  it("stamps the root for an explicit choice and clears it for system", () => {
    const root = document.createElement("html");

    applyTheme(root, "dark");
    expect(root.getAttribute("data-theme")).toBe("dark");

    applyTheme(root, "light");
    expect(root.getAttribute("data-theme")).toBe("light");

    applyTheme(root, "system");
    expect(root.hasAttribute("data-theme")).toBe(false);
  });
});
