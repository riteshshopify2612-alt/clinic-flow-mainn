import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/appointments")({
  validateSearch: (search: Record<string, unknown>) => ({
    appointmentId: typeof search.appointmentId === "string" ? search.appointmentId : undefined,
  }),
  head: () => ({ meta: [{ title: "Appointments — CURA" }] }),
  component: Appointments,
});

type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
type StatusFilter = AppointmentStatus | "all";
type DialogMode = "create" | "edit" | "reschedule";

type Patient = {
  id: string;
  patient_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  dob: string | null;
};

type Doctor = {
  id: string;
  name: string;
  specialization: string;
  email: string | null;
  phone: string | null;
  working_hours: Json;
  consultation_fee: number;
  status: string;
};

type DoctorLeave = {
  id: string;
  doctor_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
};

type Appointment = {
  id: string;
  patient_id: string | null;
  doctor_id: string | null;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  visit_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  patient: Patient | null;
  doctor: Doctor | null;
};

type StatusHistory = {
  id: string;
  appointment_id: string;
  old_status: AppointmentStatus | null;
  new_status: AppointmentStatus;
  changed_at: string;
};

type AppointmentFormState = {
  id?: string;
  patientId: string;
  patientQuery: string;
  doctorId: string;
  date: string;
  time: string;
  visitReason: string;
  notes: string;
};

type WorkingHours = {
  open: string;
  close: string;
  days: string[];
};

const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];

const ACTIVE_BOOKING_STATUSES: AppointmentStatus[] = ["scheduled", "confirmed"];
const PAGE_SIZE = 8;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const statusStyles: Record<AppointmentStatus, string> = {
  scheduled: "border-primary/20 bg-primary/10 text-primary",
  confirmed: "border-accent/20 bg-accent/10 text-accent-foreground",
  completed: "border-border bg-muted text-foreground",
  cancelled: "border-destructive/20 bg-destructive/10 text-destructive",
  no_show: "border-warning/20 bg-warning/10 text-warning",
};

const defaultWorkingHours: WorkingHours = {
  open: "09:00",
  close: "17:00",
  days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
};

function Appointments() {
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { role } = useCurrentUser();
  const canManageAppointments = role === "admin" || role === "receptionist";
  const canUpdateAppointmentStatus = canManageAppointments;
  const [filters, setFilters] = useState({
    patient: "",
    doctor: "",
    date: "",
    status: "all" as StatusFilter,
  });
  const [page, setPage] = useState(1);
  const [formDialog, setFormDialog] = useState<{
    mode: DialogMode;
    appointment?: Appointment;
  } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [calendarMode, setCalendarMode] = useState<"daily" | "weekly" | "monthly">("daily");
  const [calendarDate, setCalendarDate] = useState(todayKey());

  useEffect(() => {
    if (search.appointmentId) setDetailId(search.appointmentId);
  }, [search.appointmentId]);

  const appointmentsQuery = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          id,
          patient_id,
          doctor_id,
          appointment_date,
          appointment_time,
          status,
          visit_reason,
          notes,
          created_at,
          updated_at,
          deleted_at,
          patient:patients(id, patient_code, first_name, last_name, full_name, email, phone, date_of_birth, dob),
          doctor:doctors(id, name, specialization, email, phone, working_hours, consultation_fee, status)
        `,
        )
        .is("deleted_at", null)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as Appointment[];
    },
  });

  const patientsQuery = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select(
          "id, patient_code, first_name, last_name, full_name, email, phone, date_of_birth, dob",
        )
        .is("deleted_at", null)
        .order("last_name", { ascending: true })
        .order("first_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Patient[];
    },
  });

  const doctorsQuery = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id, name, specialization, email, phone, working_hours, consultation_fee, status")
        .is("deleted_at", null)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Doctor[];
    },
  });

  const leavesQuery = useQuery({
    queryKey: ["doctor-leaves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_leaves")
        .select("id, doctor_id, start_date, end_date, reason, status")
        .is("deleted_at", null)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DoctorLeave[];
    },
  });

  const appointments = useMemo(() => appointmentsQuery.data ?? [], [appointmentsQuery.data]);
  const patients = useMemo(() => patientsQuery.data ?? [], [patientsQuery.data]);
  const doctors = useMemo(() => doctorsQuery.data ?? [], [doctorsQuery.data]);
  const leaves = useMemo(() => leavesQuery.data ?? [], [leavesQuery.data]);
  const detailAppointment = appointments.find((appointment) => appointment.id === detailId) ?? null;

  const saveAppointment = useMutation({
    mutationFn: async (form: AppointmentFormState) => {
      validateAppointmentForm(form, doctors, appointments, leaves);
      await assertNoDatabaseConflict(form);

      const payload = {
        patient_id: form.patientId,
        doctor_id: form.doctorId,
        appointment_date: form.date,
        appointment_time: form.time,
        visit_reason: form.visitReason.trim(),
        notes: form.notes.trim() || null,
      };

      if (form.id) {
        const { error } = await supabase.from("appointments").update(payload).eq("id", form.id);
        if (error) throw error;
        return "updated";
      }

      const { error } = await supabase.from("appointments").insert({
        ...payload,
        status: "scheduled",
      });
      if (error) throw error;
      return "created";
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(result === "created" ? "Appointment booked" : "Appointment updated");
      setFormDialog(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelAppointment = useMutation({
    mutationFn: async (appointment: Appointment) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment-status-history"] });
      toast.success("Appointment cancelled");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Appointment deleted");
      setDetailId(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filteredAppointments = useMemo(() => {
    const patientNeedle = filters.patient.trim().toLowerCase();
    const doctorNeedle = filters.doctor.trim().toLowerCase();

    return appointments.filter((appointment) => {
      const patientSearch = appointment.patient
        ? [patientName(appointment.patient), appointment.patient.patient_code]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
        : "";
      const doctorName = appointment.doctor?.name.toLowerCase() ?? "";

      return (
        (!patientNeedle || patientSearch.includes(patientNeedle)) &&
        (!doctorNeedle || doctorName.includes(doctorNeedle)) &&
        (!filters.date || appointment.appointment_date === filters.date) &&
        (filters.status === "all" || appointment.status === filters.status)
      );
    });
  }, [appointments, filters]);

  useEffect(() => {
    setPage(1);
  }, [filters.patient, filters.doctor, filters.date, filters.status]);

  const summary = useMemo(() => buildSummary(appointments), [appointments]);
  const pageCount = Math.max(1, Math.ceil(filteredAppointments.length / PAGE_SIZE));
  const visibleAppointments = filteredAppointments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const queryError =
    appointmentsQuery.error ?? patientsQuery.error ?? doctorsQuery.error ?? leavesQuery.error;
  const isLoading =
    appointmentsQuery.isLoading ||
    patientsQuery.isLoading ||
    doctorsQuery.isLoading ||
    leavesQuery.isLoading;

  function openAppointment(id: string) {
    setDetailId(id);
    navigate({ to: "/appointments", search: { appointmentId: id } });
  }

  function closeAppointmentDetails(open: boolean) {
    if (open) return;
    setDetailId(null);
    if (search.appointmentId) {
      navigate({ to: "/appointments", search: { appointmentId: undefined }, replace: true });
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Scheduling
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Appointment Management</h1>
          </div>
          {canManageAppointments && (
            <Button onClick={() => setFormDialog({ mode: "create" })}>
              <Plus className="size-4" /> Book appointment
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <SummaryTile label="Today's Appointments" value={summary.today} />
          <SummaryTile label="Upcoming Appointments" value={summary.upcoming} />
          <SummaryTile label="Completed Appointments" value={summary.completed} />
          <SummaryTile label="Cancelled Appointments" value={summary.cancelled} />
          <SummaryTile label="No Show Appointments" value={summary.noShow} />
        </div>

        {queryError && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {(queryError as Error).message}
          </div>
        )}

        <Tabs defaultValue="list" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-6">
            <AppointmentFilters filters={filters} onFiltersChange={setFilters} />

            <AppointmentTable
              appointments={visibleAppointments}
              isLoading={isLoading}
              page={page}
              pageCount={pageCount}
              total={filteredAppointments.length}
              onPageChange={setPage}
              onView={(appointment) => openAppointment(appointment.id)}
              onEdit={(appointment) => setFormDialog({ mode: "edit", appointment })}
              onReschedule={(appointment) => setFormDialog({ mode: "reschedule", appointment })}
              onCancel={(appointment) => {
                if (confirm(`Cancel appointment for ${patientName(appointment.patient)}`)) {
                  cancelAppointment.mutate(appointment);
                }
              }}
              onDelete={(appointment) => {
                if (confirm(`Delete appointment for ${patientName(appointment.patient)}`)) {
                  deleteAppointment.mutate(appointment.id);
                }
              }}
              canManageAppointments={canManageAppointments}
            />
          </TabsContent>

          <TabsContent value="calendar">
            <AppointmentCalendar
              appointments={filteredAppointments}
              mode={calendarMode}
              date={calendarDate}
              onModeChange={setCalendarMode}
              onDateChange={setCalendarDate}
              onOpenAppointment={(appointment) => openAppointment(appointment.id)}
            />
          </TabsContent>
        </Tabs>

        <AppointmentDialog
          open={!!formDialog}
          mode={formDialog?.mode ?? "create"}
          appointment={formDialog?.appointment ?? null}
          patients={patients}
          doctors={doctors}
          leaves={leaves}
          appointments={appointments}
          isSaving={saveAppointment.isPending}
          onSave={(form) => saveAppointment.mutate(form)}
          onOpenChange={(open) => {
            if (!open) setFormDialog(null);
          }}
        />

        <AppointmentDetailsDialog
          appointment={detailAppointment}
          open={!!detailAppointment}
          appointments={appointments}
          canUpdateStatus={canUpdateAppointmentStatus}
          canCreatePrescription={role === "admin" || role === "doctor"}
          onOpenChange={closeAppointmentDetails}
        />
      </div>
    </TooltipProvider>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface p-5 rounded-xl border border-border">
      <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function AppointmentFilters({
  filters,
  onFiltersChange,
}: {
  filters: { patient: string; doctor: string; date: string; status: StatusFilter };
  onFiltersChange: (filters: {
    patient: string;
    doctor: string;
    date: string;
    status: StatusFilter;
  }) => void;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Search Patient
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={filters.patient}
              onChange={(event) => onFiltersChange({ ...filters, patient: event.target.value })}
              className="pl-9"
              placeholder="Patient name"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Search Doctor
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={filters.doctor}
              onChange={(event) => onFiltersChange({ ...filters, doctor: event.target.value })}
              className="pl-9"
              placeholder="Doctor name"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Filter By Date
          </Label>
          <Input
            type="date"
            value={filters.date}
            onChange={(event) => onFiltersChange({ ...filters, date: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Filter By Status
          </Label>
          <Select
            value={filters.status}
            onValueChange={(status) =>
              onFiltersChange({ ...filters, status: status as StatusFilter })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {APPOINTMENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function AppointmentTable({
  appointments,
  isLoading,
  page,
  pageCount,
  total,
  onPageChange,
  onView,
  onEdit,
  onReschedule,
  onCancel,
  onDelete,
  canManageAppointments,
}: {
  appointments: Appointment[];
  isLoading: boolean;
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  onView: (appointment: Appointment) => void;
  onEdit: (appointment: Appointment) => void;
  onReschedule: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onDelete: (appointment: Appointment) => void;
  canManageAppointments: boolean;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="px-6 py-3 text-[10px] font-mono uppercase text-muted-foreground">
                Patient Name
              </th>
              <th className="px-6 py-3 text-[10px] font-mono uppercase text-muted-foreground">
                Doctor Name
              </th>
              <th className="px-6 py-3 text-[10px] font-mono uppercase text-muted-foreground">
                Date
              </th>
              <th className="px-6 py-3 text-[10px] font-mono uppercase text-muted-foreground">
                Time
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
            {isLoading &&
              Array.from({ length: 4 }).map((_, index) => (
                <tr key={index}>
                  <td colSpan={6} className="px-6 py-4">
                    <div className="h-8 rounded-md bg-muted animate-pulse" />
                  </td>
                </tr>
              ))}

            {!isLoading &&
              appointments.map((appointment) => (
                <tr key={appointment.id}>
                  <td className="px-6 py-4">
                    <div className="font-medium">{patientName(appointment.patient)}</div>
                    <div className="text-xs text-muted-foreground">
                      {appointment.patient?.patient_code ?? "No patient ID"} ·{" "}
                      {appointment.patient?.phone ?? appointment.patient?.email ?? "No contact"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{appointment.doctor?.name ?? "Unassigned"}</div>
                    <div className="text-xs text-muted-foreground">
                      {appointment.doctor?.specialization ?? "—"}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    {formatDate(appointment.appointment_date)}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs tabular-nums">
                    {formatTime(appointment.appointment_time)}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={appointment.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex gap-1">
                      <ActionButton label="View" icon={Eye} onClick={() => onView(appointment)} />
                      {canManageAppointments && (
                        <>
                          <ActionButton
                            label="Edit"
                            icon={Pencil}
                            onClick={() => onEdit(appointment)}
                          />
                          <ActionButton
                            label="Reschedule"
                            icon={RotateCcw}
                            onClick={() => onReschedule(appointment)}
                          />
                          <ActionButton
                            label="Cancel"
                            icon={XCircle}
                            onClick={() => onCancel(appointment)}
                          />
                          <ActionButton
                            label="Delete"
                            icon={Trash2}
                            onClick={() => onDelete(appointment)}
                          />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

            {!isLoading && appointments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground">
                  No appointments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 py-3">
        <div className="text-xs text-muted-foreground">
          Showing {appointments.length} of {total} appointments
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="size-4" /> Previous
          </Button>
          <span className="font-mono text-xs text-muted-foreground">
            {page} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            disabled={page === pageCount}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function AppointmentDialog({
  open,
  mode,
  appointment,
  patients,
  doctors,
  leaves,
  appointments,
  isSaving,
  onSave,
  onOpenChange,
}: {
  open: boolean;
  mode: DialogMode;
  appointment: Appointment | null;
  patients: Patient[];
  doctors: Doctor[];
  leaves: DoctorLeave[];
  appointments: Appointment[];
  isSaving: boolean;
  onSave: (form: AppointmentFormState) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<AppointmentFormState>(() => buildFormState(appointment));
  const selectedDoctor = doctors.find((doctor) => doctor.id === form.doctorId) ?? null;
  const availableSlots = useMemo(
    () =>
      getAvailableSlots({
        doctor: selectedDoctor,
        date: form.date,
        appointments,
        leaves,
        currentAppointmentId: form.id,
      }),
    [appointments, form.date, form.id, leaves, selectedDoctor],
  );

  useEffect(() => {
    if (open) setForm(buildFormState(appointment));
  }, [appointment, open]);

  const title =
    mode === "create"
      ? "Book appointment"
      : mode === "reschedule"
        ? "Reschedule appointment"
        : "Edit appointment";
  const hasDoctorAndDate = Boolean(form.doctorId && form.date);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a scheduled visit with an available doctor slot."
              : "Update appointment details while preserving existing records."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PatientSelector
            patients={patients}
            patientId={form.patientId}
            query={form.patientQuery}
            onQueryChange={(patientQuery) =>
              setForm((current) => ({
                ...current,
                patientQuery,
                patientId:
                  current.patientId &&
                  patientName(patients.find((patient) => patient.id === current.patientId)) ===
                    patientQuery
                    ? current.patientId
                    : "",
              }))
            }
            onSelect={(patient) =>
              setForm((current) => ({
                ...current,
                patientId: patient.id,
                patientQuery: patientName(patient),
              }))
            }
          />

          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Select Doctor
            </Label>
            <Select
              value={form.doctorId}
              onValueChange={(doctorId) =>
                setForm((current) => ({ ...current, doctorId, time: "" }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doctor) => {
                  const hours = normalizeWorkingHours(doctor.working_hours);
                  return (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.name} · {doctor.specialization} · {hours.open}-{hours.close}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Appointment Date
            </Label>
            <Input
              type="date"
              value={form.date}
              onChange={(event) =>
                setForm((current) => ({ ...current, date: event.target.value, time: "" }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Appointment Time
            </Label>
            <Select
              value={form.time}
              onValueChange={(time) => setForm((current) => ({ ...current, time }))}
              disabled={availableSlots.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose available slot" />
              </SelectTrigger>
              <SelectContent>
                {availableSlots.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {formatTime(slot)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasDoctorAndDate && availableSlots.length === 0 && (
              <p className="text-xs text-destructive">
                No available slots for this doctor on the selected date.
              </p>
            )}
            {!hasDoctorAndDate && (
              <p className="text-xs text-muted-foreground">
                Select a doctor and date to see available slots.
              </p>
            )}
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Visit Reason
            </Label>
            <Input
              value={form.visitReason}
              onChange={(event) =>
                setForm((current) => ({ ...current, visitReason: event.target.value }))
              }
              maxLength={200}
              placeholder="Follow-up, consultation, annual checkup"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Notes
            </Label>
            <Textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              rows={3}
              maxLength={800}
              placeholder="Optional preparation notes or internal context"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(form)} disabled={isSaving}>
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            {mode === "create" ? "Book appointment" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PatientSelector({
  patients,
  patientId,
  query,
  onQueryChange,
  onSelect,
}: {
  patients: Patient[];
  patientId: string;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (patient: Patient) => void;
}) {
  const filteredPatients = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return patients.slice(0, 6);
    return patients
      .filter((patient) => {
        const haystack = [patient.patient_code, patientName(patient), patient.email, patient.phone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .slice(0, 8);
  }, [patients, query]);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        Select Patient
      </Label>
      <Input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search patients"
      />
      <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-background">
        {filteredPatients.map((patient) => (
          <button
            key={patient.id}
            type="button"
            onClick={() => onSelect(patient)}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors ${
              patient.id === patientId ? "bg-primary/5 text-primary" : ""
            }`}
          >
            <span className="font-medium">{patientName(patient)}</span>
            <span className="block text-xs text-muted-foreground">
              {patient.patient_code} · {patient.phone ?? patient.email ?? "No contact details"}
            </span>
          </button>
        ))}
        {filteredPatients.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No patients match your search.
          </div>
        )}
      </div>
    </div>
  );
}

function AppointmentCalendar({
  appointments,
  mode,
  date,
  onModeChange,
  onDateChange,
  onOpenAppointment,
}: {
  appointments: Appointment[];
  mode: "daily" | "weekly" | "monthly";
  date: string;
  onModeChange: (mode: "daily" | "weekly" | "monthly") => void;
  onDateChange: (date: string) => void;
  onOpenAppointment: (appointment: Appointment) => void;
}) {
  const heading =
    mode === "daily"
      ? formatDate(date)
      : mode === "weekly"
        ? `${formatDate(startOfWeekKey(date))} - ${formatDate(addDays(startOfWeekKey(date), 6))}`
        : formatMonth(date);
  const step = mode === "daily" ? 1 : mode === "weekly" ? 7 : 30;

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="border-b border-border p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Calendar View
          </p>
          <h2 className="font-semibold">{heading}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => onDateChange(addDays(date, -step))}>
            <ChevronLeft className="size-4" />
            <span className="sr-only">Previous</span>
          </Button>
          <Input
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            className="w-auto"
          />
          <Button variant="outline" size="icon" onClick={() => onDateChange(addDays(date, step))}>
            <ChevronRight className="size-4" />
            <span className="sr-only">Next</span>
          </Button>
          <Tabs value={mode} onValueChange={(value) => onModeChange(value as typeof mode)}>
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {mode === "daily" && (
        <div className="p-4 space-y-3">
          {appointmentsForDate(appointments, date).map((appointment) => (
            <CalendarAppointment
              key={appointment.id}
              appointment={appointment}
              onOpen={() => onOpenAppointment(appointment)}
            />
          ))}
          {appointmentsForDate(appointments, date).length === 0 && (
            <EmptyCalendarState label="No appointments for this day." />
          )}
        </div>
      )}

      {mode === "weekly" && (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 min-w-[760px]">
            {Array.from({ length: 7 }).map((_, index) => {
              const day = addDays(startOfWeekKey(date), index);
              const dayAppointments = appointmentsForDate(appointments, day);
              return (
                <div key={day} className="min-h-72 border-r border-border last:border-r-0 p-3">
                  <div className="font-mono text-xs text-muted-foreground mb-3">
                    {formatDayHeader(day)}
                  </div>
                  <div className="space-y-2">
                    {dayAppointments.map((appointment) => (
                      <CalendarAppointment
                        key={appointment.id}
                        appointment={appointment}
                        compact
                        onOpen={() => onOpenAppointment(appointment)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === "monthly" && (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 min-w-[860px]">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div
                key={day}
                className="border-b border-r border-border last:border-r-0 px-3 py-2 text-[10px] font-mono uppercase text-muted-foreground"
              >
                {day}
              </div>
            ))}
            {monthCells(date).map((day) => {
              const dayAppointments = appointmentsForDate(appointments, day);
              const outsideMonth = parseDateKey(day).getMonth() !== parseDateKey(date).getMonth();
              return (
                <div
                  key={day}
                  className={`min-h-32 border-b border-r border-border last:border-r-0 p-2 ${
                    outsideMonth ? "bg-muted/30 text-muted-foreground" : ""
                  }`}
                >
                  <div className="font-mono text-xs mb-2">{parseDateKey(day).getDate()}</div>
                  <div className="space-y-1">
                    {dayAppointments.slice(0, 3).map((appointment) => (
                      <button
                        key={appointment.id}
                        onClick={() => onOpenAppointment(appointment)}
                        className="block w-full rounded bg-primary/5 px-2 py-1 text-left text-[11px] hover:bg-primary/10"
                      >
                        <span className="font-mono">
                          {normalizeTime(appointment.appointment_time)}
                        </span>{" "}
                        {patientName(appointment.patient)}
                      </button>
                    ))}
                    {dayAppointments.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">
                        +{dayAppointments.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarAppointment({
  appointment,
  compact = false,
  onOpen,
}: {
  appointment: Appointment;
  compact?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className={`w-full rounded-lg border border-border bg-background text-left hover:border-primary/40 hover:bg-primary/5 transition-colors ${
        compact ? "p-2" : "p-4"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs tabular-nums">
          {formatTime(appointment.appointment_time)}
        </span>
        <StatusBadge status={appointment.status} compact />
      </div>
      <div className="font-medium text-sm mt-2 truncate">{patientName(appointment.patient)}</div>
      {!compact && (
        <div className="text-xs text-muted-foreground mt-1">
          {appointment.doctor?.name ?? "Unassigned"} · {appointment.visit_reason ?? "Visit"}
        </div>
      )}
    </button>
  );
}

function AppointmentDetailsDialog({
  appointment,
  open,
  appointments,
  canUpdateStatus,
  canCreatePrescription,
  onOpenChange,
}: {
  appointment: Appointment | null;
  open: boolean;
  appointments: Appointment[];
  canUpdateStatus: boolean;
  canCreatePrescription: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [nextStatus, setNextStatus] = useState<AppointmentStatus>("scheduled");

  useEffect(() => {
    if (appointment) setNextStatus(appointment.status);
  }, [appointment]);

  const historyQuery = useQuery({
    queryKey: ["appointment-status-history", appointment?.id],
    enabled: !!appointment?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_status_history")
        .select("id, appointment_id, old_status, new_status, changed_at")
        .eq("appointment_id", appointment!.id)
        .is("deleted_at", null)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StatusHistory[];
    },
  });

  const encounterQuery = useQuery({
    queryKey: ["appointment-encounter", appointment?.id],
    enabled: !!appointment?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_encounters")
        .select("id")
        .eq("appointment_id", appointment!.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string } | null;
    },
  });

  const statusUpdate = useMutation({
    mutationFn: async (status: AppointmentStatus) => {
      if (!appointment) throw new Error("Appointment not found");
      if (ACTIVE_BOOKING_STATUSES.includes(status)) {
        const conflict = appointments.some(
          (item) =>
            item.id !== appointment.id &&
            item.doctor_id === appointment.doctor_id &&
            item.appointment_date === appointment.appointment_date &&
            normalizeTime(item.appointment_time) === normalizeTime(appointment.appointment_time) &&
            ACTIVE_BOOKING_STATUSES.includes(item.status),
        );
        if (conflict) {
          throw new Error("This doctor already has an active appointment in that slot.");
        }
      }

      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", appointment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment-status-history", appointment?.id] });
      toast.success("Appointment status updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Appointment Details</DialogTitle>
          <DialogDescription>
            Patient, doctor, visit information, and status movement.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <InfoSection title="Patient Information">
            <InfoRow label="Patient ID" value={appointment.patient?.patient_code ?? "—"} />
            <InfoRow label="Name" value={patientName(appointment.patient)} />
            <InfoRow label="Phone" value={appointment.patient?.phone ?? "—"} />
            <InfoRow label="Email" value={appointment.patient?.email ?? "—"} />
            <InfoRow
              label="DOB"
              value={
                patientDob(appointment.patient) ? formatDate(patientDob(appointment.patient)!) : "—"
              }
            />
            {appointment.patient && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/patients/$patientId" params={{ patientId: appointment.patient.id }}>
                  View patient profile
                </Link>
              </Button>
            )}
          </InfoSection>

          <InfoSection title="Doctor Information">
            <InfoRow label="Name" value={appointment.doctor?.name ?? "Unassigned"} />
            <InfoRow label="Specialty" value={appointment.doctor?.specialization ?? "—"} />
            <InfoRow label="Phone" value={appointment.doctor?.phone ?? "—"} />
            <InfoRow label="Email" value={appointment.doctor?.email ?? "—"} />
          </InfoSection>

          <InfoSection title="Appointment Information">
            <InfoRow label="Date" value={formatDate(appointment.appointment_date)} />
            <InfoRow label="Time" value={formatTime(appointment.appointment_time)} />
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-muted-foreground">Status</div>
              <div className="col-span-2">
                <StatusBadge status={appointment.status} />
              </div>
            </div>
            <InfoRow label="Created" value={formatDateTime(appointment.created_at)} />
          </InfoSection>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InfoSection title="Visit Reason">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {appointment.visit_reason ?? "No visit reason recorded."}
            </p>
          </InfoSection>
          <InfoSection title="Notes">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {appointment.notes ?? "No notes recorded."}
            </p>
          </InfoSection>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InfoSection title="Status Management">
            {canUpdateStatus ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <Select
                  value={nextStatus}
                  onValueChange={(status) => setNextStatus(status as AppointmentStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => statusUpdate.mutate(nextStatus)}
                  disabled={statusUpdate.isPending || nextStatus === appointment.status}
                >
                  {statusUpdate.isPending && <Loader2 className="size-4 animate-spin" />}
                  Update
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your role can view appointment status but cannot update it.
              </p>
            )}
          </InfoSection>

          <InfoSection title="Status History">
            <div className="space-y-3">
              {historyQuery.isLoading && <div className="h-12 rounded-md bg-muted animate-pulse" />}
              {(historyQuery.data ?? []).map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 text-sm">
                  <div className="mt-1 size-2 rounded-full bg-primary" />
                  <div>
                    <div className="font-medium">
                      {entry.old_status
                        ? `${statusLabel(entry.old_status)} to ${statusLabel(entry.new_status)}`
                        : statusLabel(entry.new_status)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(entry.changed_at)}
                    </div>
                  </div>
                </div>
              ))}
              {!historyQuery.isLoading && (historyQuery.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No status history yet.</p>
              )}
            </div>
          </InfoSection>
        </div>

        {canCreatePrescription && (
          <InfoSection title="Encounter Prescription">
            {encounterQuery.isLoading ? (
              <div className="h-10 rounded-md bg-muted animate-pulse" />
            ) : encounterQuery.data ? (
              <Button variant="outline" asChild>
                <Link to="/prescriptions" search={{ encounterId: encounterQuery.data.id }}>
                  <FileText className="size-4" />
                  Create prescription
                </Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                No encounter is linked to this appointment yet.
              </p>
            )}
          </InfoSection>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
      <h3 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2 break-words">{value}</div>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" onClick={onClick} aria-label={label}>
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function StatusBadge({
  status,
  compact = false,
}: {
  status: AppointmentStatus;
  compact?: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={`${statusStyles[status]} ${compact ? "px-1.5 py-0 text-[10px]" : ""}`}
    >
      {statusLabel(status)}
    </Badge>
  );
}

function EmptyCalendarState({ label }: { label: string }) {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <CalendarDays className="mx-auto mb-3 size-8 opacity-50" />
      {label}
    </div>
  );
}

function buildSummary(appointments: Appointment[]) {
  const today = todayKey();
  return appointments.reduce(
    (summary, appointment) => {
      if (appointment.appointment_date === today) summary.today += 1;
      if (
        appointment.appointment_date > today &&
        ACTIVE_BOOKING_STATUSES.includes(appointment.status)
      ) {
        summary.upcoming += 1;
      }
      if (appointment.status === "completed") summary.completed += 1;
      if (appointment.status === "cancelled") summary.cancelled += 1;
      if (appointment.status === "no_show") summary.noShow += 1;
      return summary;
    },
    { today: 0, upcoming: 0, completed: 0, cancelled: 0, noShow: 0 },
  );
}

function patientName(patient: Patient | null | undefined) {
  if (!patient) return "Unknown patient";
  const composed = `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim();
  return composed || patient.full_name || "Unknown patient";
}

function patientDob(patient: Patient | null | undefined) {
  return patient?.date_of_birth ?? patient?.dob ?? null;
}

function buildFormState(appointment: Appointment | null): AppointmentFormState {
  return {
    id: appointment?.id,
    patientId: appointment?.patient_id ?? "",
    patientQuery: appointment?.patient ? patientName(appointment.patient) : "",
    doctorId: appointment?.doctor_id ?? "",
    date: appointment?.appointment_date ?? todayKey(),
    time: appointment ? normalizeTime(appointment.appointment_time) : "",
    visitReason: appointment?.visit_reason ?? "",
    notes: appointment?.notes ?? "",
  };
}

function validateAppointmentForm(
  form: AppointmentFormState,
  doctors: Doctor[],
  appointments: Appointment[],
  leaves: DoctorLeave[],
) {
  if (!form.patientId) throw new Error("Select a patient before booking.");
  if (!form.doctorId) throw new Error("Select a doctor before booking.");
  if (!form.date) throw new Error("Choose an appointment date.");
  if (!form.time) throw new Error("Choose an available appointment time.");
  if (!form.visitReason.trim()) throw new Error("Visit reason is required.");

  const doctor = doctors.find((item) => item.id === form.doctorId) ?? null;
  if (!doctor) throw new Error("Selected doctor could not be found.");

  const slots = getAvailableSlots({
    doctor,
    date: form.date,
    appointments,
    leaves,
    currentAppointmentId: form.id,
  });

  if (!slots.includes(form.time)) {
    throw new Error("Selected slot is unavailable for this doctor.");
  }
}

async function assertNoDatabaseConflict(form: AppointmentFormState) {
  let query = supabase
    .from("appointments")
    .select("id")
    .eq("doctor_id", form.doctorId)
    .eq("appointment_date", form.date)
    .eq("appointment_time", form.time)
    .in("status", ACTIVE_BOOKING_STATUSES)
    .limit(1);

  if (form.id) query = query.neq("id", form.id);

  const { data, error } = await query;
  if (error) throw error;
  if ((data ?? []).length > 0) {
    throw new Error("This doctor already has an active appointment in that slot.");
  }
}

function getAvailableSlots({
  doctor,
  date,
  appointments,
  leaves,
  currentAppointmentId,
}: {
  doctor: Doctor | null;
  date: string;
  appointments: Appointment[];
  leaves: DoctorLeave[];
  currentAppointmentId?: string;
}) {
  if (!doctor || !date || doctor.status !== "active") return [];

  const workingHours = normalizeWorkingHours(doctor.working_hours);
  const dayLabel = DAY_LABELS[parseDateKey(date).getDay()];
  if (!workingHours.days.includes(dayLabel)) return [];
  if (isDoctorOnLeave(doctor.id, date, leaves)) return [];

  const start = timeToMinutes(workingHours.open);
  const end = timeToMinutes(workingHours.close);
  if (end <= start) return [];

  const slots: string[] = [];
  for (let minute = start; minute < end; minute += 30) {
    const slot = minutesToTime(minute);
    const isTaken = appointments.some(
      (appointment) =>
        appointment.id !== currentAppointmentId &&
        appointment.doctor_id === doctor.id &&
        appointment.appointment_date === date &&
        normalizeTime(appointment.appointment_time) === slot &&
        ACTIVE_BOOKING_STATUSES.includes(appointment.status),
    );

    if (!isTaken) slots.push(slot);
  }

  return slots;
}

function normalizeWorkingHours(value: Json): WorkingHours {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const days = Array.isArray(record.days)
    ? record.days.filter((day): day is string => typeof day === "string")
    : defaultWorkingHours.days;

  return {
    open: typeof record.open === "string" ? normalizeTime(record.open) : defaultWorkingHours.open,
    close:
      typeof record.close === "string" ? normalizeTime(record.close) : defaultWorkingHours.close,
    days,
  };
}

function isDoctorOnLeave(doctorId: string, date: string, leaves: DoctorLeave[]) {
  const day = parseDateKey(date).getTime();
  return leaves.some((leave) => {
    if (leave.doctor_id !== doctorId || leave.status === "cancelled") return false;
    return (
      parseDateKey(leave.start_date).getTime() <= day &&
      parseDateKey(leave.end_date).getTime() >= day
    );
  });
}

function appointmentsForDate(appointments: Appointment[], date: string) {
  return appointments
    .filter((appointment) => appointment.appointment_date === date)
    .sort((a, b) =>
      normalizeTime(a.appointment_time).localeCompare(normalizeTime(b.appointment_time)),
    );
}

function monthCells(date: string) {
  const first = new Date(parseDateKey(date).getFullYear(), parseDateKey(date).getMonth(), 1);
  const start = startOfWeekKey(toDateKey(first));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function statusLabel(status: AppointmentStatus) {
  const labels: Record<AppointmentStatus, string> = {
    scheduled: "Scheduled",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No Show",
  };
  return labels[status];
}

function todayKey() {
  return toDateKey(new Date());
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: string, amount: number) {
  const next = parseDateKey(date);
  next.setDate(next.getDate() + amount);
  return toDateKey(next);
}

function startOfWeekKey(date: string) {
  const current = parseDateKey(date);
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  current.setDate(current.getDate() + diff);
  return toDateKey(current);
}

function normalizeTime(time: string | null | undefined) {
  return time ? time.slice(0, 5) : "";
}

function timeToMinutes(time: string) {
  const [hours, minutes] = normalizeTime(time).split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatDate(date: string) {
  return parseDateKey(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDayHeader(date: string) {
  return parseDateKey(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatMonth(date: string) {
  return parseDateKey(date).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatTime(time: string) {
  const [hours, minutes] = normalizeTime(time).split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
