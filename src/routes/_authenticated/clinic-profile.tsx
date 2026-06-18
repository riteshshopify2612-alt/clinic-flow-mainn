import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/error-message";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clinic-profile")({
  head: () => ({ meta: [{ title: "Clinic Profile — CURA" }] }),
  component: ClinicProfile,
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ClinicData = {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  working_hours: { open: string; close: string; days: string[] };
  consultation_fee: number;
};

function ClinicProfile() {
  const qc = useQueryClient();
  const { isAdmin } = useCurrentUser();

  const { data: clinic } = useQuery({
    queryKey: ["clinic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_profile")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ClinicData | null;
    },
  });

  const [form, setForm] = useState<ClinicData | null>(null);
  useEffect(() => {
    if (clinic) setForm(clinic);
  }, [clinic]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const { error } = await supabase
        .from("clinic_profile")
        .update({
          name: form.name,
          logo_url: form.logo_url,
          address: form.address,
          phone: form.phone,
          email: form.email,
          working_hours: form.working_hours,
          consultation_fee: Number(form.consultation_fee) || 0,
        })
        .eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic"] });
      toast.success("Clinic profile saved");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to save clinic profile")),
  });

  if (!form) return <div className="text-sm text-muted-foreground">Loading…</div>;

  function toggleDay(d: string) {
    setForm(
      (f) =>
        f && {
          ...f,
          working_hours: {
            ...f.working_hours,
            days: f.working_hours.days.includes(d)
              ? f.working_hours.days.filter((x) => x !== d)
              : [...f.working_hours.days, d],
          },
        },
    );
  }

  const readonly = !isAdmin;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          Configuration
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Clinic Profile</h1>
      </div>

      <div className="bg-surface rounded-xl border border-border p-6 space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-border">
          {form.logo_url ? (
            <img
              src={form.logo_url}
              alt={form.name}
              className="size-16 rounded-xl object-cover bg-muted"
            />
          ) : (
            <div className="size-16 rounded-xl bg-muted flex items-center justify-center">
              <Building2 className="size-7 text-muted-foreground" />
            </div>
          )}
          <div>
            <div className="font-semibold text-lg">{form.name || "Untitled Clinic"}</div>
            <div className="text-xs text-muted-foreground">{form.address || "No address set"}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Clinic name
            </Label>
            <Input
              disabled={readonly}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={120}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Logo URL
            </Label>
            <Input
              disabled={readonly}
              value={form.logo_url ?? ""}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Address
            </Label>
            <Textarea
              disabled={readonly}
              value={form.address ?? ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2}
              maxLength={300}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Phone
            </Label>
            <Input
              disabled={readonly}
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              maxLength={40}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Email
            </Label>
            <Input
              disabled={readonly}
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              maxLength={255}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Opens
            </Label>
            <Input
              disabled={readonly}
              type="time"
              value={form.working_hours.open}
              onChange={(e) =>
                setForm({ ...form, working_hours: { ...form.working_hours, open: e.target.value } })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Closes
            </Label>
            <Input
              disabled={readonly}
              type="time"
              value={form.working_hours.close}
              onChange={(e) =>
                setForm({
                  ...form,
                  working_hours: { ...form.working_hours, close: e.target.value },
                })
              }
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Working days
            </Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={readonly}
                  onClick={() => toggleDay(d)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                    form.working_hours.days.includes(d)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-surface text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Default consultation fee ($)
            </Label>
            <Input
              disabled={readonly}
              type="number"
              min={0}
              value={form.consultation_fee}
              onChange={(e) => setForm({ ...form, consultation_fee: Number(e.target.value) })}
            />
          </div>
        </div>

        {isAdmin ? (
          <div className="flex justify-end pt-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Save changes
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only administrators can edit clinic settings.
          </p>
        )}
      </div>
    </div>
  );
}
