import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authStatus } from "@/lib/auth";

export default function SignInPage() {
  return (
    <Card className="surface-panel w-full max-w-md border-0">
      <CardHeader className="space-y-4">
        <Badge className="w-fit bg-primary/10 text-primary hover:bg-primary/10">
          Auth disabled
        </Badge>
        <CardTitle className="font-heading text-3xl">Sign-in route shell</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-6 text-muted-foreground">
          {authStatus.reason}
        </p>
        <div className="space-y-3">
          <Input disabled defaultValue="agency-operator@example.com" />
          <Button disabled className="w-full rounded-full">
            Continue
          </Button>
        </div>
        <Button asChild variant="secondary" className="w-full rounded-full">
          <Link href="/dashboard">Open dashboard shell instead</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
