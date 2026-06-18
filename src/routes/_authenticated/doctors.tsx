import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/error-message";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CalendarOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/doctors")({
  head: () => ({ meta: [{ title: "Doctors — CURA" }] }),
  component: Doctors,
});

type Doctor = {
  id: string;
  name: string;
  specialization: string;
  email: string | null;
  phone: string | null;
  working_hours: { open: string; close: string; days: string[] };
  consultation_fee: number;
  status: string;
  deleted_at?: string | null;
};

type Leave = {
  id: string;
  doctor_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  deleted_at?: string | null;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Doctors() {
  const qc = useQueryClient();
  const { isAdmin } = useCurrentUser();
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [open, setOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState<Doctor | null>(null);

  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Doctor[];
    },
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["doctor-leaves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_leaves")
        .select("*")
        .is("deleted_at", null)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Leave[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("doctors")
        .update({ deleted_at: new Date().toISOString(), status: "inactive" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctors"] });
      toast.success("Doctor removed");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to remove doctor")),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Staff
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Doctor Management</h1>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-4 mr-1.5" /> Add doctor
          </Button>
        )}
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="px-6 py-3 text-[10px] font-mono uppercase text-muted-foreground">
                  Doctor
                </th>
                <th className="px-6 py-3 text-[10px] font-mono uppercase text-muted-foreground">
                  Specialization
                </th>
                <th className="px-6 py-3 text-[10px] font-mono uppercase text-muted-foreground">
                  Schedule
                </th>
                <th className="px-6 py-3 text-[10px] font-mono uppercase text-muted-foreground">
                  Fee
                </th>
                <th className="px-6 py-3 text-[10px] font-mono uppercase text-muted-foreground">
                  Status
                </th>
                <th className="px-6 py-3 text-[10px] font-mono uppercase text-muted-foreground text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {doctors.map((d) => {
                const onLeave = leaves.some(
                  (l) =>
                    l.doctor_id === d.id &&
                    new Date(l.start_date) <= new Date() &&
                    new Date(l.end_date) >= new Date(),
                );
                return (
                  <tr key={d.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.email ?? d.phone ?? "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{d.specialization}</td>
                    <td className="px-6 py-4 font-mono text-xs">
                      <div>
                        {d.working_hours?.open} – {d.working_hours?.close}
                      </div>
                      <div className="text-muted-foreground">
                        {(d.working_hours?.days ?? []).join(" · ")}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs tabular-nums">
                      ${Number(d.consultation_fee).toFixed(0)}
                    </td>
                    <td className="px-6 py-4">
                      {onLeave ? (
                        <span className="px-2 py-1 bg-warning/10 text-warning text-[10px] font-bold rounded uppercase">
                          On Leave
                        </span>
                      ) : d.status === "active" ? (
                        <span className="px-2 py-1 bg-accent/10 text-accent-foreground text-[10px] font-bold rounded uppercase">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-muted text-muted-foreground text-[10px] font-bold rounded uppercase">
                          {d.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isAdmin && (
                        <div className="inline-flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setLeaveOpen(d)}
                            aria-label="Manage leave"
                          >
                            <CalendarOff className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing(d);
                              setOpen(true);
                            }}
                            aria-label="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Remove ${d.name}?`)) del.mutate(d.id);
                            }}
                            aria-label="Delete"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {doctors.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No doctors yet. {isAdmin && "Click 'Add doctor' to get started."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DoctorDialog open={open} onOpenChange={setOpen} doctor={editing} />
      {leaveOpen && (
        <LeaveDialog
          doctor={leaveOpen}
          onClose={() => setLeaveOpen(null)}
          leaves={leaves.filter((l) => l.doctor_id === leaveOpen.id)}
        />
      )}
    </div>
  );
}

function DoctorDialog({
  open,
  onOpenChange,
  doctor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doctor: Doctor | null;
}) {
  const qc = useQueryClient();
  const isEdit = !!doctor;

  const [form, setForm] = useState(() => ({
    name: doctor?.name ?? "",
    specialization: doctor?.specialization ?? "",
    email: doctor?.email ?? "",
    phone: doctor?.phone ?? "",
    open: doctor?.working_hours?.open ?? "09:00",
    close: doctor?.working_hours?.close ?? "17:00",
    days: doctor?.working_hours?.days ?? ["Mon", "Tue", "Wed", "Thu", "Fri"],
    fee: doctor?.consultation_fee ?? 0,
    status: doctor?.status ?? "active",
  }));

  useEffect(() => {
    setForm({
      name: doctor?.name ?? "",
      specialization: doctor?.specialization ?? "",
      email: doctor?.email ?? "",
      phone: doctor?.phone ?? "",
      open: doctor?.working_hours?.open ?? "09:00",
      close: doctor?.working_hours?.close ?? "17:00",
      days: doctor?.working_hours?.days ?? ["Mon", "Tue", "Wed", "Thu", "Fri"],
      fee: doctor?.consultation_fee ?? 0,
      status: doctor?.status ?? "active",
    });
  }, [doctor]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        specialization: form.specialization.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        working_hours: { open: form.open, close: form.close, days: form.days },
        consultation_fee: Number(form.fee) || 0,
        status: form.status,
      };
      if (!payload.name || !payload.specialization)
        throw new Error("Name and specialization are required");
      if (isEdit && doctor) {
        const { error } = await supabase.from("doctors").update(payload).eq("id", doctor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("doctors").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctors"] });
      toast.success(isEdit ? "Doctor updated" : "Doctor added");
      onOpenChange(false);
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to save doctor")),
  });

  function toggleDay(d: string) {
    setForm((f) => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d],
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit doctor" : "Add doctor"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Name
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Specialization
              </Label>
              <Input
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Consultation fee ($)
              </Label>
              <Input
                type="number"
                min={0}
                value={form.fee}
                onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                maxLength={255}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Phone
              </Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Opens
              </Label>
              <Input
                type="time"
                value={form.open}
                onChange={(e) => setForm({ ...form, open: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Closes
              </Label>
              <Input
                type="time"
                value={form.close}
                onChange={(e) => setForm({ ...form, close: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Working days
              </Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      form.days.includes(d)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-surface text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {isEdit ? "Save changes" : "Add doctor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaveDialog({
  doctor,
  onClose,
  leaves,
}: {
  doctor: Doctor;
  onClose: () => void;
  leaves: Leave[];
}) {
  const qc = useQueryClient();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      if (!start || !end) throw new Error("Start and end dates required");
      const { error } = await supabase.from("doctor_leaves").insert({
        doctor_id: doctor.id,
        start_date: start,
        end_date: end,
        reason: reason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor-leaves"] });
      setStart("");
      setEnd("");
      setReason("");
      toast.success("Leave added");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Failed to add leave")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("doctor_leaves")
        .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doctor-leaves"] }),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Leave — {doctor.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                From
              </Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                To
              </Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Reason (optional)
            </Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </div>
          <Button className="w-full" onClick={() => add.mutate()} disabled={add.isPending}>
            <Plus className="size-4 mr-1.5" /> Record leave
          </Button>

          <div className="border-t border-border pt-3 space-y-2 max-h-48 overflow-y-auto">
            {leaves.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No leave records.</p>
            )}
            {leaves.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2 text-xs"
              >
                <div>
                  <div className="font-mono">
                    {l.start_date} → {l.end_date}
                  </div>
                  {l.reason && <div className="text-muted-foreground">{l.reason}</div>}
                </div>
                <button
                  onClick={() => remove.mutate(l.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
