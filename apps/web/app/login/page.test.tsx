import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const signInEmail = vi.fn();
const signUpEmail = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  signIn: { email: (...a: unknown[]) => signInEmail(...a) },
  signUp: { email: (...a: unknown[]) => signUpEmail(...a) },
}));

import LoginPage from "./page";

function fillAndSubmit(email = "test@exemple.fr", password = "motdepasse123") {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    push.mockClear();
    signInEmail.mockReset();
    signUpEmail.mockReset();
  });

  it("throw path: shows error and re-enables submit button when signIn.email throws", async () => {
    signInEmail.mockRejectedValueOnce(new Error("network failure"));

    render(<LoginPage />);
    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/erreur réseau/i),
    );
    expect(screen.getByRole("button", { name: /se connecter/i })).not.toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("result.error path: shows translated error message when signIn.email returns an error", async () => {
    signInEmail.mockResolvedValueOnce({
      error: { code: "INVALID_EMAIL_OR_PASSWORD" },
      data: null,
    });

    render(<LoginPage />);
    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/email ou mot de passe incorrect/i),
    );
    expect(push).not.toHaveBeenCalled();
  });
});
