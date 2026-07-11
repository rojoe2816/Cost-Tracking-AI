import type { AuthStatus } from "@/lib/auth/types";

export const authStatus: AuthStatus = {
  enabled: true,
  mode: "signed-session",
  reason:
    "Slate uses signed, expiring HTTP-only sessions and revalidates organization membership for protected dashboard access.",
};
