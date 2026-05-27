/**
 * VULTRA — Admin Portal Auth Client (Better Auth)
 *
 * Initializes the Better Auth client with the organization plugin.
 * Import `authClient` for all auth operations.
 *
 * Note: Passkey plugin is not enabled in the current Better Auth version.
 */

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  plugins: [
    organizationClient(),
  ],
});

export const {
  useSession,
  useActiveOrganization,
  signIn,
  signOut,
  organization,
} = authClient;
