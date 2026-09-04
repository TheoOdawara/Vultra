import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { UNKNOWN_ERROR_MESSAGE } from "@/shared/api/errors";
import { server } from "@/test/msw";
import {
  DEFAULT_RETRY_AFTER_SECONDS,
  DISABLED_ACCOUNT_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
} from "../sign-in-messages";
import { SignInForm } from "./sign-in-form";

const API = "https://api.vultra.test";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));

function signInFails(status: number, code: string, headers: Record<string, string> = {}) {
  server.use(
    http.post(`${API}/api/auth/sign-in/email`, () =>
      HttpResponse.json({ code, message: "English prose from the server" }, { status, headers })
    )
  );
}

function signInSucceedsAs(role: string) {
  server.use(
    http.post(`${API}/api/auth/sign-in/email`, () =>
      HttpResponse.json({ redirect: false, token: "t", user: { id: "u1" } })
    ),
    http.get(`${API}/api/auth/get-session`, () =>
      HttpResponse.json({ user: { id: "u1" }, member: { role } })
    )
  );
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, password = "senha-correta") {
  await user.type(screen.getByLabelText("E-mail"), "ana@escola.test");
  await user.type(screen.getByLabelText("Senha"), password);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("the sign-in screen", () => {
  it("labels both fields and never uses the placeholder as the label", () => {
    render(<SignInForm next={null} />);

    const email = screen.getByLabelText("E-mail");
    const password = screen.getByLabelText("Senha");

    expect(email).toHaveAttribute("type", "email");
    expect(password).toHaveAttribute("type", "password");
    expect(email).not.toHaveAttribute("placeholder");
    expect(password).not.toHaveAttribute("placeholder");
  });

  it("sends the professor to the home of the role", async () => {
    signInSucceedsAs("professor");
    const user = userEvent.setup();
    render(<SignInForm next={null} />);

    await fillAndSubmit(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/attendance"));
  });

  it("honours next when it belongs to the role", async () => {
    signInSucceedsAs("gestor");
    const user = userEvent.setup();
    render(<SignInForm next="/devices" />);

    await fillAndSubmit(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/devices"));
  });

  it("ignores a next that belongs to another role", async () => {
    signInSucceedsAs("professor");
    const user = userEvent.setup();
    render(<SignInForm next="/audit-logs" />);

    await fillAndSubmit(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/attendance"));
  });

  it("refuses a bad credential, clears the password and takes the focus back", async () => {
    signInFails(401, "INVALID_EMAIL_OR_PASSWORD");
    const user = userEvent.setup();
    render(<SignInForm next={null} />);

    await fillAndSubmit(user, "senha-errada");

    expect(await screen.findByText(INVALID_CREDENTIALS_MESSAGE)).toBeInTheDocument();
    const password = screen.getByLabelText("Senha");
    await waitFor(() => expect(password).toHaveValue(""));
    await waitFor(() => expect(password).toHaveFocus());
    expect(replace).not.toHaveBeenCalled();
  });

  it("never shows the English prose that came from the server", async () => {
    signInFails(500, "SOMETHING_ELSE");
    const user = userEvent.setup();
    render(<SignInForm next={null} />);

    await fillAndSubmit(user);

    expect(await screen.findByText(UNKNOWN_ERROR_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/English prose/)).not.toBeInTheDocument();
  });

  it("points a disabled account at the manager", async () => {
    signInFails(403, "BANNED_USER");
    const user = userEvent.setup();
    render(<SignInForm next={null} />);

    await fillAndSubmit(user);

    expect(await screen.findByText(DISABLED_ACCOUNT_MESSAGE)).toBeInTheDocument();
  });

  it("announces the failure in an assertive live region", async () => {
    signInFails(401, "INVALID_EMAIL_OR_PASSWORD");
    const user = userEvent.setup();
    render(<SignInForm next={null} />);

    await fillAndSubmit(user);

    const region = await screen.findByText(INVALID_CREDENTIALS_MESSAGE);
    expect(region).toHaveAttribute("aria-live", "assertive");
  });

  it("refuses to leave when the session carries no role", async () => {
    server.use(
      http.post(`${API}/api/auth/sign-in/email`, () =>
        HttpResponse.json({ redirect: false, token: "t", user: { id: "u1" } })
      ),
      http.get(`${API}/api/auth/get-session`, () => HttpResponse.json({ user: { id: "u1" } }))
    );
    const user = userEvent.setup();
    render(<SignInForm next={null} />);

    await fillAndSubmit(user);

    expect(await screen.findByText(UNKNOWN_ERROR_MESSAGE)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not reach the network while the e-mail is not an e-mail", async () => {
    const user = userEvent.setup();
    render(<SignInForm next={null} />);

    await user.type(screen.getByLabelText("E-mail"), "ana");
    await user.type(screen.getByLabelText("Senha"), "senha-correta");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe um e-mail válido.")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("the quota block on sign-in", () => {
  it("counts the Retry-After down and keeps Entrar disabled until it ends", async () => {
    signInFails(429, "RATE_LIMIT_EXCEEDED", { "Retry-After": "2" });
    const user = userEvent.setup();
    render(<SignInForm next={null} />);

    await fillAndSubmit(user);

    const button = screen.getByRole("button", { name: "Entrar" });

    expect(
      await screen.findByText("Muitas tentativas. Tente novamente em 2 segundos.")
    ).toBeVisible();
    expect(button).toBeDisabled();

    await waitFor(() =>
      expect(screen.getByText("Muitas tentativas. Tente novamente em 1 segundos.")).toBeVisible()
    );
    expect(button).toBeDisabled();

    await waitFor(() => expect(button).toBeEnabled(), { timeout: 3000 });
  });

  it("falls back to a declared wait when the 429 carries no Retry-After", async () => {
    signInFails(429, "RATE_LIMIT_EXCEEDED");
    const user = userEvent.setup();
    render(<SignInForm next={null} />);

    await fillAndSubmit(user);

    expect(
      await screen.findByText(
        `Muitas tentativas. Tente novamente em ${DEFAULT_RETRY_AFTER_SECONDS} segundos.`
      )
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeDisabled();
  });
});
