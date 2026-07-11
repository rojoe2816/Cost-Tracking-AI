import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import {
  signInAction,
  signInLocalDemoAction,
} from "@/app/(auth)/sign-in/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getDashboardSession,
  isLocalDemoSignInAvailable,
  isProductionAdminAuthConfigured,
} from "@/lib/auth/session";

const errorMessages: Record<string, string> = {
  "invalid-credentials":
    "The credentials or workspace membership could not be verified.",
  "local-demo-unavailable":
    "Local demo sign-in is available only for a loopback development URL.",
};

export default async function SignInPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getDashboardSession()) redirect("/dashboard");

  const searchParams = await props.searchParams;
  const localDemoAvailable = isLocalDemoSignInAvailable();
  const productionCredentialsConfigured = isProductionAdminAuthConfigured();
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
          Sessions are signed, HTTP-only, and bound to a current organization
          membership. Credential and model settings require Owner or Admin access.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <form action={signInAction} className="space-y-4">
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Email</span>
            <Input name="email" type="email" autoComplete="username" required />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Password</span>
            <Input name="password" type="password" autoComplete="current-password" required />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Workspace slug</span>
            <Input name="organizationSlug" placeholder="demo-agency" autoComplete="organization" />
          </label>
          <Button type="submit" className="w-full gap-2 rounded-full">
            <LockKeyhole className="h-4 w-4" /> Continue securely
          </Button>
        </form>

        {localDemoAvailable ? (
          <form action={signInLocalDemoAction}>
            <Button type="submit" variant="secondary" className="w-full gap-2 rounded-full">
              <KeyRound className="h-4 w-4" /> Use local seeded owner
            </Button>
          </form>
        ) : null}

        {!productionCredentialsConfigured && !localDemoAvailable ? (
          <p className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">
            Production admin credentials are not configured. Slate fails closed
            until the required secrets are supplied.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
