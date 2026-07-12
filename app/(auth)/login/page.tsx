import { LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/(auth)/login/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardSession } from "@/lib/auth/session";

const errorMessages: Record<string, string> = {
  "invalid-credentials": "Invalid username or password.",
  locked: "Too many failed attempts. Try again later.",
};

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  if (await getDashboardSession()) redirect("/dashboard");

  const searchParams = await props.searchParams;
  const next = searchParams.next?.startsWith("/")
    ? searchParams.next
    : "/dashboard";
  const error = searchParams.error
    ? errorMessages[searchParams.error] ?? "Sign-in failed safely. Please retry."
    : null;

  return (
    <Card className="surface-panel w-full max-w-md border-0">
      <CardHeader className="space-y-4">
        <Badge className="w-fit gap-2 bg-primary/10 text-primary hover:bg-primary/10">
          <ShieldCheck className="h-3.5 w-3.5" /> Protected workspace
        </Badge>
        <CardTitle className="font-heading text-3xl">Sign in to Slate</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          Username and password sessions are signed, HTTP-only, and bound to a
          current organization membership.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Username</span>
            <Input
              name="username"
              type="text"
              autoComplete="username"
              required
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Password</span>
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Workspace slug</span>
            <Input
              name="organizationSlug"
              placeholder="demo-agency"
              autoComplete="organization"
            />
          </label>
          <Button type="submit" className="w-full gap-2 rounded-full">
            <LockKeyhole className="h-4 w-4" /> Continue securely
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
