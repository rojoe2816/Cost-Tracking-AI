import type { AuthStatus } from "@/lib/auth/types";

export const authStatus: AuthStatus = {
  enabled: false,
  mode: "disabled",
  reason:
    "Authentication is intentionally deferred in this milestone. The app shell and Prisma data model are prepared for agency memberships and role-based access.",
};
