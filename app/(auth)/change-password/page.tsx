import { redirect } from "next/navigation";

import { changePasswordAction } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireDashboardSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function ChangePasswordPage(props: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const session = await requireDashboardSession();
  const searchParams = await props.searchParams;
  const next = searchParams.next?.startsWith("/")
    ? searchParams.next
    : "/dashboard";
  const credential = await db.passwordCredential.findUnique({
    where: { userId: session.userId },
    select: { username: true, mustChangePassword: true },
  });

  if (!credential) redirect("/login" as import("next").Route);

  return (
    <Card className="surface-panel w-full max-w-md border-0">
      <CardHeader className="space-y-3">
        <CardTitle className="font-heading text-3xl">Change password</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          {credential.mustChangePassword
            ? "You must replace the seeded password before continuing."
            : "Choose a new password for your Slate administrator account."}
        </p>
      </CardHeader>
      <CardContent>
        {searchParams.error ? (
          <div
            role="alert"
            className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {searchParams.error}
          </div>
        ) : null}
        <form action={changePasswordAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="username" value={credential.username} />
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Current password</span>
            <Input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">New password</span>
            <Input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Confirm new password</span>
            <Input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
            />
          </label>
          <Button type="submit" className="w-full rounded-full">
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
