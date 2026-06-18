import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/error-message";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — CURA" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Check your inbox for the reset link.");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to send reset email"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 animate-entrance">
        <Link
          to="/auth"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to sign in
        </Link>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            We'll email you a secure link to set a new password.
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-border bg-surface p-4 text-sm">
            <p className="font-medium">Email sent</p>
            <p className="text-muted-foreground mt-1">
              If an account exists for {email}, you'll receive a reset link shortly.
            </p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                placeholder="you@clinic.com"
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
              Send reset link
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
