import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/error-message";
import { toast } from "sonner";
import { Activity, Loader2 } from "lucide-react";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — CURA" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initialMode } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = z
          .object({
            fullName: z.string().trim().min(1).max(100),
            email: z.string().trim().email().max(255),
            password: z.string().min(8).max(72),
          })
          .safeParse({ fullName, email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. Welcome.");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
        navigate({ to: "/dashboard" });
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Authentication failed"));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message);
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="size-9 bg-primary-foreground/15 rounded flex items-center justify-center">
            <Activity className="size-5" />
          </div>
          <span className="font-semibold tracking-tight text-lg">CURA Admin</span>
        </div>
        <div className="space-y-6 relative z-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-70">
            Clinic operating system
          </p>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight max-w-md">
            Run your clinic with the precision of a surgical instrument.
          </h1>
          <p className="text-sm opacity-80 max-w-sm leading-relaxed">
            Appointments, patient records, staff schedules and revenue — unified into one calm,
            modern workspace.
          </p>
        </div>
        <div className="font-mono text-[10px] opacity-60 uppercase tracking-wider">
          v1.0 · HIPAA-aware architecture
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8 animate-entrance">
          <div className="lg:hidden flex items-center gap-3">
            <div className="size-9 bg-primary rounded flex items-center justify-center text-primary-foreground">
              <Activity className="size-5" />
            </div>
            <span className="font-semibold tracking-tight text-lg">CURA Admin</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Sign in to your clinic" : "Create your clinic account"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "signin"
                ? "Welcome back. Enter your credentials to continue."
                : "The first account becomes the clinic administrator."}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-11"
            onClick={onGoogle}
            disabled={loading}
          >
            <svg className="size-4 mr-2" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
              <span className="bg-background px-2 text-muted-foreground">Or with email</span>
            </div>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label
                  htmlFor="name"
                  className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
                >
                  Full name
                </Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  maxLength={100}
                  placeholder="Dr. Sarah Jenkins"
                />
              </div>
            )}
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
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                placeholder="you@clinic.com"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
                >
                  Password
                </Label>
                {mode === "signin" && (
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot?
                  </Link>
                )}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                maxLength={72}
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New to CURA?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary font-medium hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
