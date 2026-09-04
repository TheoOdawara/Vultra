import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ROLES, type Role } from "@/shared/auth/guards";
import { navItemsFor } from "@/shared/navigation/navigation";
import { AppShell } from "./app-shell";

let pathname = "/members";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

function renderShell(role: Role | null, at = "/members") {
  pathname = at;
  return render(
    <AppShell role={role}>
      <h1>Conteúdo</h1>
    </AppShell>
  );
}

function stayOnThePage(event: MouseEvent) {
  event.preventDefault();
}

function sidebar() {
  return screen.getByRole("navigation", { name: "Navegação principal" });
}

describe("the area shell", () => {
  it.each(ROLES)("gives %s the navigation of its own role and nothing else", (role) => {
    renderShell(role, "/nowhere");

    const links = within(sidebar()).getAllByRole("link");
    const expected = navItemsFor(role);

    expect(links.map((link) => link.textContent)).toEqual(expected.map((item) => item.label));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      expected.map((item) => item.href)
    );
  });

  it("gives rh exactly one item", () => {
    renderShell("rh", "/reports/wellbeing");

    expect(within(sidebar()).getAllByRole("link")).toHaveLength(1);
  });

  it("marks the open route as the current page", () => {
    renderShell("gestor", "/classes/abc");

    const current = within(sidebar()).getByRole("link", { current: "page" });
    expect(current).toHaveAttribute("href", "/classes");
  });

  it("marks nothing when the open route is outside the navigation", () => {
    renderShell("gestor", "/member-imports");

    expect(within(sidebar()).queryByRole("link", { current: "page" })).toBeNull();
  });

  it("groups the manager items under the labels of the screen map", () => {
    renderShell("gestor");

    for (const label of ["Cadastro", "Biometria", "Relatórios", "Governança"]) {
      expect(within(sidebar()).getByText(label)).toBeVisible();
    }
  });

  it("renders the content without any navigation when no role reached the shell", () => {
    renderShell(null);

    expect(screen.getByRole("heading", { name: "Conteúdo" })).toBeVisible();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("button", { name: "Abrir navegação" })).toBeNull();
  });
});

describe("the navigation below 768 px", () => {
  it("keeps the items behind a sheet the header opens", async () => {
    const user = userEvent.setup();
    renderShell("professor", "/attendance");

    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Abrir navegação" }));

    const sheet = await screen.findByRole("dialog");
    expect(
      within(sheet)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(navItemsFor("professor").map((item) => item.label));
  });

  it("closes the sheet once an item is chosen", async () => {
    const user = userEvent.setup();
    document.addEventListener("click", stayOnThePage);
    renderShell("professor", "/attendance");

    await user.click(screen.getByRole("button", { name: "Abrir navegação" }));
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("link", { name: "Minhas turmas" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    document.removeEventListener("click", stayOnThePage);
  });

  it("hides the sheet trigger from 768 px up and the sidebar below it", () => {
    renderShell("gestor");

    expect(screen.getByRole("button", { name: "Abrir navegação" }).closest("header")).toHaveClass(
      "md:hidden"
    );
    expect(sidebar().closest("aside")).toHaveClass("hidden", "md:block");
  });

  it("gives every item a touch target of at least 44 px", () => {
    renderShell("professor", "/attendance");

    for (const link of within(sidebar()).getAllByRole("link")) {
      expect(link).toHaveClass("min-h-11");
    }
  });
});
