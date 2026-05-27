/**
 * VULTRA — Admin Portal Auth Client (Better Auth)
 *
 * Initializes the Better Auth client with organization and passkey plugins.
 * Import `authClient` for all auth operations.
 */

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { passkeyClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  plugins: [
    organizationClient(),
    passkeyClient(),
  ],
});

export const {
  useSession,
  useActiveOrganization,
  signIn,
  signOut,
  organization,
} = authClient;
