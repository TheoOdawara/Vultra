"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { UNKNOWN_ERROR_MESSAGE } from "@/shared/api/errors";
import { authClient } from "@/shared/auth/auth-client";
import { fetchCurrentSession } from "@/shared/auth/current-session";
import { resolveDestination } from "@/shared/auth/destination";
import { Button } from "@/shared/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/form";
import { Input } from "@/shared/ui/input";
import {
  DEFAULT_RETRY_AFTER_SECONDS,
  messageForSignInFailure,
  rateLimitMessage,
} from "../sign-in-messages";

const signInSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").pipe(z.email("Informe um e-mail válido.")),
  password: z.string().min(1, "Informe a senha."),
});

type SignInValues = z.infer<typeof signInSchema>;

function retryAfterOf(response: Response | null): number | undefined {
  const header = response?.headers.get("Retry-After");
  if (header === null || header === undefined) return undefined;

  const seconds = Number.parseInt(header, 10);
  return Number.isNaN(seconds) || seconds <= 0 ? undefined : seconds;
}

export function SignInForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [blockedSeconds, setBlockedSeconds] = useState(0);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (blockedSeconds <= 0) return;

    const timer = setTimeout(() => setBlockedSeconds((remaining) => remaining - 1), 1000);
    return () => clearTimeout(timer);
  }, [blockedSeconds]);

  function refuse(message: string) {
    setFailureMessage(message);
    form.resetField("password");
    form.setFocus("password");
  }

  async function onSubmit(values: SignInValues) {
    setFailureMessage(null);

    let lastResponse: Response | null = null;

    const { error } = await authClient.signIn.email(
      { email: values.email, password: values.password },
      {
        onResponse: (context: { response: Response }) => {
          lastResponse = context.response;
        },
      }
    );

    if (error) {
      const retryAfterSeconds = retryAfterOf(lastResponse);

      if (error.status === 429) {
        setBlockedSeconds(retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS);
      }

      refuse(
        messageForSignInFailure({ status: error.status, code: error.code, retryAfterSeconds })
      );
      return;
    }

    const session = await fetchCurrentSession();

    if (session === null) {
      refuse(UNKNOWN_ERROR_MESSAGE);
      return;
    }

    router.replace(resolveDestination(next, session.role));
  }

  const isBlocked = blockedSeconds > 0;
  const message = isBlocked ? rateLimitMessage(blockedSeconds) : failureMessage;

  return (
    <Form {...form}>
      <form className="grid gap-6" noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input autoComplete="email" inputMode="email" type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha</FormLabel>
              <FormControl>
                <Input autoComplete="current-password" type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <p aria-live="assertive" className="min-h-5 text-sm text-danger">
          {message}
        </p>

        <Button
          className="w-full"
          disabled={isBlocked || form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </Form>
  );
}
