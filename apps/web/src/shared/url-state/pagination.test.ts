import { describe, expect, it } from "vitest";
import {
  canGoNext,
  canGoPrevious,
  decodeCursorStack,
  encodeCursorStack,
  FIRST_PAGE,
  goToNextPage,
  goToPreviousPage,
  PAGE_SIZE,
} from "./pagination";

describe("cursor pagination", () => {
  it("fixes the page size at 50", () => {
    expect(PAGE_SIZE).toBe(50);
  });

  it("starts with no cursor and an empty stack", () => {
    expect(FIRST_PAGE).toEqual({ cursor: null, cursorStack: [] });
    expect(canGoPrevious(FIRST_PAGE)).toBe(false);
  });

  it("enables Proximo only while the API answers a next cursor", () => {
    expect(canGoNext("c2")).toBe(true);
    expect(canGoNext(null)).toBe(false);
  });

  it("walks forward pushing the page left behind onto the stack", () => {
    const second = goToNextPage(FIRST_PAGE, "c2");
    expect(second).toEqual({ cursor: "c2", cursorStack: [] });
    expect(canGoPrevious(second)).toBe(true);

    const third = goToNextPage(second, "c3");
    expect(third).toEqual({ cursor: "c3", cursorStack: ["c2"] });
  });

  it("refuses to walk past the last page", () => {
    const second = goToNextPage(FIRST_PAGE, "c2");

    expect(goToNextPage(second, null)).toBe(second);
  });

  it("walks back through the stack and lands on the first page", () => {
    const third = goToNextPage(goToNextPage(FIRST_PAGE, "c2"), "c3");

    const second = goToPreviousPage(third);
    expect(second).toEqual({ cursor: "c2", cursorStack: [] });

    const first = goToPreviousPage(second);
    expect(first).toEqual(FIRST_PAGE);
    expect(canGoPrevious(first)).toBe(false);
  });

  it("round trips the stack through the url", () => {
    expect(encodeCursorStack([])).toBe(null);
    expect(encodeCursorStack(["c2", "c3"])).toBe("c2~c3");
    expect(decodeCursorStack("c2~c3")).toEqual(["c2", "c3"]);
    expect(decodeCursorStack(null)).toEqual([]);
    expect(decodeCursorStack("")).toEqual([]);
  });
});
