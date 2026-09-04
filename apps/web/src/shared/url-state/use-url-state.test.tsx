import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { useCursorPagination } from "./use-cursor-pagination";
import { useUrlState } from "./use-url-state";

const replace = vi.fn();
let currentSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/members",
  useSearchParams: () => currentSearch,
}));

const schema = z.object({
  search: z.string().default(""),
  sort: z.enum(["fullName", "createdAt"]).default("fullName"),
  cursor: z.string().optional(),
  cursorStack: z.string().optional(),
});

function MembersScreen({ nextCursor }: { nextCursor: string | null }) {
  const { values, setValues } = useUrlState(schema);
  const pagination = useCursorPagination(values, setValues, nextCursor);

  return (
    <div>
      <output data-testid="search">{values.search}</output>
      <output data-testid="cursor">{values.cursor ?? "none"}</output>
      <button type="button" onClick={() => setValues({ search: "ana" })}>
        Buscar ana
      </button>
      <button type="button" disabled={!pagination.hasPrevious} onClick={pagination.goPrevious}>
        Anterior
      </button>
      <button type="button" disabled={!pagination.hasNext} onClick={pagination.goNext}>
        Próximo
      </button>
    </div>
  );
}

function setUrl(query: string) {
  currentSearch = new URLSearchParams(query);
}

describe("url state", () => {
  beforeEach(() => {
    replace.mockClear();
    setUrl("");
  });

  it("rebuilds the screen from the url on reload", () => {
    setUrl("search=ana&cursor=c2&cursorStack=c1");
    render(<MembersScreen nextCursor="c3" />);

    expect(screen.getByTestId("search")).toHaveTextContent("ana");
    expect(screen.getByTestId("cursor")).toHaveTextContent("c2");
  });

  it("writes with replace, so a filter does not stack history", async () => {
    const user = userEvent.setup();
    render(<MembersScreen nextCursor={null} />);

    await user.click(screen.getByRole("button", { name: "Buscar ana" }));

    expect(replace).toHaveBeenCalledWith("/members?search=ana");
  });

  it("clears cursor and stack when a filter changes", async () => {
    setUrl("cursor=c2&cursorStack=c1");
    const user = userEvent.setup();
    render(<MembersScreen nextCursor="c3" />);

    await user.click(screen.getByRole("button", { name: "Buscar ana" }));

    expect(replace).toHaveBeenCalledWith("/members?search=ana");
  });

  it("carries cursor and stack into the url on Proximo", async () => {
    setUrl("cursor=c2");
    const user = userEvent.setup();
    render(<MembersScreen nextCursor="c3" />);

    await user.click(screen.getByRole("button", { name: "Próximo" }));

    expect(replace).toHaveBeenCalledWith("/members?cursor=c3&cursorStack=c2");
  });

  it("disables Proximo on the last page and Anterior on the first", () => {
    render(<MembersScreen nextCursor={null} />);

    expect(screen.getByRole("button", { name: "Próximo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
  });

  it("enables Anterior once a cursor is in the url", () => {
    setUrl("cursor=c2");
    render(<MembersScreen nextCursor="c3" />);

    expect(screen.getByRole("button", { name: "Anterior" })).toBeEnabled();
  });

  it("returns to a clean url when walking back to the first page", async () => {
    setUrl("cursor=c2");
    const user = userEvent.setup();
    render(<MembersScreen nextCursor="c3" />);

    await user.click(screen.getByRole("button", { name: "Anterior" }));

    expect(replace).toHaveBeenCalledWith("/members");
  });

  it("drops an invalid parameter instead of breaking the screen", () => {
    setUrl("sort=whatever&search=ana");
    render(<MembersScreen nextCursor={null} />);

    expect(screen.getByTestId("search")).toHaveTextContent("ana");
  });

  it("resets to the first page when the cursor is refused by the API", () => {
    setUrl("cursor=expired&cursorStack=c1");
    const { rerender } = render(<MembersScreen nextCursor={null} />);

    const pagination = { current: null as null | (() => void) };
    function Reset() {
      const { values, setValues } = useUrlState(schema);
      const cursor = useCursorPagination(values, setValues, null);
      pagination.current = cursor.resetToFirstPage;
      return null;
    }
    rerender(
      <>
        <MembersScreen nextCursor={null} />
        <Reset />
      </>
    );

    act(() => pagination.current?.());

    expect(replace).toHaveBeenCalledWith("/members");
  });
});
