import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DENIED_MESSAGE, ROLE_HOME, ROLES } from "@/shared/auth/guards";
import { DeniedScreen } from "./denied-screen";

describe("the denied screen", () => {
  it("says what happened in PT-BR", () => {
    render(<DeniedScreen viewerRole={null} />);

    expect(screen.getByRole("heading", { name: "Acesso negado" })).toBeVisible();
    expect(screen.getByText(DENIED_MESSAGE)).toBeVisible();
  });

  it.each(ROLES)("offers %s a way back to the home of its own role", (role) => {
    render(<DeniedScreen viewerRole={role} />);

    expect(screen.getByRole("link", { name: "Ir para o início" })).toHaveAttribute(
      "href",
      ROLE_HOME[role]
    );
  });

  it("offers no way back when no role reached the screen", () => {
    render(<DeniedScreen viewerRole={null} />);

    expect(screen.queryByRole("link", { name: "Ir para o início" })).toBeNull();
  });
});
