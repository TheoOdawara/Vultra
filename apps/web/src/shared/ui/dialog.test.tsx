import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

function MemberDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Novo membro</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo membro</DialogTitle>
          <DialogDescription>Cadastre um membro da instituição.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("dialog primitive", () => {
  it("opens by keyboard and moves the focus into itself", async () => {
    const user = userEvent.setup();
    render(<MemberDialog />);

    await user.tab();
    expect(screen.getByRole("button", { name: "Novo membro" })).toHaveFocus();

    await user.keyboard("{Enter}");

    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement | null)
    );
  });

  it("keeps Tab inside the open dialog", async () => {
    const user = userEvent.setup();
    render(<MemberDialog />);

    await user.click(screen.getByRole("button", { name: "Novo membro" }));
    const dialog = await screen.findByRole("dialog");

    for (let press = 0; press < 6; press += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement | null);
    }
  });

  it("closes on Escape and gives the focus back to the trigger", async () => {
    const user = userEvent.setup();
    render(<MemberDialog />);

    const trigger = screen.getByRole("button", { name: "Novo membro" });
    await user.click(trigger);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("names the dialog for assistive technology", async () => {
    const user = userEvent.setup();
    render(<MemberDialog />);

    await user.click(screen.getByRole("button", { name: "Novo membro" }));

    expect(await screen.findByRole("dialog")).toHaveAccessibleName("Novo membro");
  });
});
