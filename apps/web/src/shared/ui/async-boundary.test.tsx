import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api/errors";
import { AsyncBoundary } from "./async-boundary";
import { Button } from "./button";
import { SkeletonText } from "./skeleton-text";
import { Table, TableBody, TableCell, TableRow } from "./table";

interface Member {
  id: string;
  fullName: string;
  email: string;
}

const PAGE: Member[] = Array.from({ length: 3 }, (_, index) => ({
  id: `m${index}`,
  fullName: `Membro ${index}`,
  email: `membro${index}@escola.test`,
}));

function MemberRow({ member }: { member: Member | null }) {
  return (
    <TableRow>
      <TableCell>{member === null ? <SkeletonText width="12ch" /> : member.fullName}</TableCell>
      <TableCell>{member === null ? <SkeletonText width="20ch" /> : member.email}</TableCell>
    </TableRow>
  );
}

function MemberTable({ members }: { members: (Member | null)[] }) {
  return (
    <Table>
      <TableBody>
        {members.map((member, index) => (
          <MemberRow key={member?.id ?? `skeleton-${index}`} member={member} />
        ))}
      </TableBody>
    </Table>
  );
}

function screenUnderTest(
  overrides: Partial<Parameters<typeof AsyncBoundary>[0]> = {},
  onRetry = vi.fn()
) {
  const skeletonRows: (Member | null)[] = Array.from({ length: PAGE.length }, () => null);

  return {
    onRetry,
    ...render(
      <AsyncBoundary
        isLoading={false}
        error={null}
        isEmpty={false}
        onRetry={onRetry}
        skeleton={<MemberTable members={skeletonRows} />}
        empty={{
          filtered: false,
          emptyMessage: "Nenhum membro cadastrado ainda.",
          filteredMessage: "Nenhum membro encontrado com esses filtros.",
          action: <Button>Novo membro</Button>,
        }}
        {...overrides}
      >
        <MemberTable members={PAGE} />
      </AsyncBoundary>
    ),
  };
}

function shapeOf(container: HTMLElement): string[] {
  return [...container.querySelectorAll("tr")].map((row) =>
    [...row.querySelectorAll("td")].map((cell) => cell.className).join("|")
  );
}

describe("the four async states", () => {
  it("shows the skeleton while loading and announces it", () => {
    const { container } = screenUnderTest({ isLoading: true });

    const boundary = container.querySelector("[data-slot='async-boundary']");
    expect(boundary).toHaveAttribute("data-status", "loading");
    expect(boundary).toHaveAttribute("aria-busy", "true");
  });

  it("gives the skeleton the same row and cell shape as the content", () => {
    const loading = render(<MemberTable members={PAGE.map(() => null)} />);
    const loadingShape = shapeOf(loading.container);
    loading.unmount();

    const success = render(<MemberTable members={PAGE} />);

    expect(shapeOf(success.container)).toEqual(loadingShape);
    expect(loadingShape).toHaveLength(PAGE.length);
  });

  it("gives every skeleton bar the height of the line it replaces", () => {
    const { container } = render(<MemberTable members={PAGE.map(() => null)} />);

    const bars = container.querySelectorAll("[data-slot='skeleton-text']");
    expect(bars.length).toBe(PAGE.length * 2);
    for (const bar of bars) {
      expect(bar.getAttribute("style")).toContain("height: 1em");
      expect(bar).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("says what is empty and offers the primary action", () => {
    screenUnderTest({ isEmpty: true });

    expect(screen.getByText("Nenhum membro cadastrado ainda.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo membro" })).toBeInTheDocument();
  });

  it("distinguishes an empty filter from an empty institution", () => {
    screenUnderTest({
      isEmpty: true,
      empty: {
        filtered: true,
        emptyMessage: "Nenhum membro cadastrado ainda.",
        filteredMessage: "Nenhum membro encontrado com esses filtros.",
        action: <Button>Novo membro</Button>,
      },
    });

    expect(screen.getByText("Nenhum membro encontrado com esses filtros.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo membro" })).not.toBeInTheDocument();
  });

  it("shows the mapped message, the correlation id and a retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const error = new ApiError({
      status: 403,
      code: "INSUFFICIENT_PERMISSIONS",
      correlationId: "0198c4a1-6f3e-7c21-9a44-1b2c3d4e5f60",
      serverMessage: "Insufficient permissions",
    });

    screenUnderTest({ error }, onRetry);

    expect(screen.getByText("Você não tem permissão para esta ação.")).toBeInTheDocument();
    expect(screen.getByText("0198c4a1-6f3e-7c21-9a44-1b2c3d4e5f60")).toBeInTheDocument();
    expect(screen.getByText("Informe este código ao suporte.")).toBeInTheDocument();
    expect(screen.queryByText(/Insufficient permissions/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows the content when the data is there", () => {
    const { container } = screenUnderTest();

    expect(container.querySelector("[data-slot='async-boundary']")).toHaveAttribute(
      "data-status",
      "success"
    );
    expect(screen.getByText("Membro 0")).toBeInTheDocument();
  });
});
