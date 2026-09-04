import { z } from "zod";
import { env } from "@/shared/env/env";
import { ROLES, type Role } from "./guards";

const sessionSchema = z.object({
  user: z.object({ id: z.string() }),
  member: z.object({ role: z.enum(ROLES) }).optional(),
});

export const SESSION_PATH = "/api/auth/get-session";

export interface Session {
  userId: string;
  role: Role;
}

export function parseSession(payload: unknown): Session | null {
  const parsed = sessionSchema.safeParse(payload);
  if (!parsed.success || parsed.data.member === undefined) return null;

  return { userId: parsed.data.user.id, role: parsed.data.member.role };
}

export async function fetchSession(cookieHeader: string | null): Promise<Session | null> {
  if (cookieHeader === null || cookieHeader === "") return null;

  let response: Response;

  try {
    response = await fetch(`${env.NEXT_PUBLIC_API_URL}${SESSION_PATH}`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return null;
  }

  return parseSession(payload);
}
