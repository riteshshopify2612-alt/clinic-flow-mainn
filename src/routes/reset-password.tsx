import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/error-message";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set new password — CURA" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update password"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6 animate-entrance">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
          <p className="text-sm text-muted-foreground">
            Choose a strong password you haven't used before.
          </p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
            >
              New password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              maxLength={72}
            />
          </div>
          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
