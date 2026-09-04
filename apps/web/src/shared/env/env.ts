import { z } from "zod";

const absoluteUrl = z
  .string()
  .min(1, "is required, expected an absolute url without a trailing slash")
  .refine((value) => /^https?:\/\/[^\s/]+/.test(value), {
    message: "expected an absolute url such as https://api.example.com",
  })
  .refine((value) => !value.endsWith("/"), {
    message: "expected an absolute url without a trailing slash",
  });

const schema = z.object({
  NEXT_PUBLIC_API_URL: absoluteUrl,
  NEXT_PUBLIC_APP_URL: absoluteUrl,
});

export type Env = z.infer<typeof schema>;

export function readEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);

  if (!result.success) {
    const lines = result.error.issues.map((issue) => {
      const name = issue.path.join(".");
      const reason = issue.code === "invalid_type" ? "is required" : issue.message;
      return `  ${name}: ${reason}`;
    });
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }

  return result.data;
}

export const env: Env = readEnv({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
