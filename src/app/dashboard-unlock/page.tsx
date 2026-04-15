import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { unlockDashboardPreviewGate } from "./actions";

export const dynamic = "force-dynamic";

type UnlockPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function DashboardUnlockPage({
  searchParams,
}: UnlockPageProps) {
  const { error } = await searchParams;
  const gateConfigured = Boolean(
    process.env.CLISTE_DASHBOARD_GATE_SECRET?.trim()
  );

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center p-6">
      <Card className="border-border w-full max-w-md shadow-md">
        <CardHeader className="text-center">
          <CardTitle>Dashboard access</CardTitle>
          <CardDescription>
            Every{" "}
            <code className="text-xs">/dashboard</code> route uses this
            password first (separate from salon sign-in). Set{" "}
            <code className="text-xs">CLISTE_DASHBOARD_GATE_SECRET</code> in{" "}
            <code className="text-xs">.env.local</code> or your deploy env to
            the value you enter below, then restart the server if you just
            added it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!gateConfigured ? (
            <p className="text-destructive text-sm" role="alert">
              <code className="text-xs">CLISTE_DASHBOARD_GATE_SECRET</code> is
              not set on the server. Add it and restart before you can unlock.
            </p>
          ) : null}
          <form action={unlockDashboardPreviewGate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dash-gate-pw">Dashboard password</Label>
              <Input
                id="dash-gate-pw"
                name="password"
                type="password"
                required
                autoComplete="off"
                placeholder="••••••••"
                disabled={!gateConfigured}
              />
            </div>
            {error === "config" ? (
              <p className="text-destructive text-sm" role="alert">
                Server configuration error. Ensure{" "}
                <code className="text-xs">CLISTE_DASHBOARD_GATE_SECRET</code> is
                set and restart.
              </p>
            ) : null}
            {error === "1" ? (
              <p className="text-destructive text-sm" role="alert">
                Wrong password. Try again.
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={!gateConfigured}
            >
              Continue to dashboard
            </Button>
          </form>
          <p className="text-muted-foreground text-center text-xs">
            <Link href="/login" className="underline-offset-4 hover:underline">
              Supabase sign-in
            </Link>
            {" · "}
            <Link href="/" className="underline-offset-4 hover:underline">
              Home
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
