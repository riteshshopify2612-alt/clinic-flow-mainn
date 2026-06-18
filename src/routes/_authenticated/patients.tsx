import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
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
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { getErrorMessage } from "@/lib/error-message";

export const Route = createFileRoute("/_authenticated/patients")({
  head: () => ({ meta: [{ title: "Patients — CURA" }] }),
  component: Patients,
});

type Patient = Tables<"patients">;
type PatientInsert = TablesInsert<"patients">;
type PatientUpdate = TablesUpdate<"patients">;
type PatientStats = Database["public"]["Views"]["patient_statistics"]["Row"];
type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

type UpcomingAppointment = {
  id: string;
  patient_id: string | null;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  doctor: { name: string } | null;
};

type PatientFormState = {
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  bloodGroup: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergies: string;
  currentMedications: string;
  medicalHistory: string;
  notes: string;
};

type GenderFilter = "all" | "male" | "female" | "other" | "unknown";
type SortKey = "newest" | "name" | "patient_code" | "last_visit";

const PAGE_SIZE = 8;
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = ["male", "female", "other", "unknown"];

function Patients() {
  const qc = useQueryClient();
  const { role } = useCurrentUser();
  const canManagePatients = role === "admin" || role === "receptionist";
  const canArchivePatients = role === "admin";
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [bloodGroupFilter, setBloodGroupFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  const patientsQuery = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select(
          `
          id,
          patient_code,
          first_name,
          last_name,
          full_name,
          date_of_birth,
          dob,
          gender,
          phone,
          email,
          address,
          blood_group,
          emergency_contact_name,
          emergency_contact_phone,
          allergies,
          current_medications,
          medical_history,
          notes,
          created_at,
          updated_at,
          deleted_at,
          created_by,
          updated_by
        `,
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Patient[];
    },
  });

  const statsQuery = useQuery({
    queryKey: ["patient-statistics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("patient_statistics").select("*");
      if (error) throw error;
      return (data ?? []) as PatientStats[];
    },
  });

  const upcomingQuery = useQuery({
    queryKey: ["patients-upcoming-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, patient_id, appointment_date, appointment_time, status, doctor:doctors(name)")
        .is("deleted_at", null)
        .gte("appointment_date", todayKey())
        .in("status", ["scheduled", "confirmed"])
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as UpcomingAppointment[];
    },
  });

  const savePatient = useMutation({
    mutationFn: async (form: PatientFormState) => {
      validatePatientForm(form);
      const payload = buildPatientPayload(form);

      if (form.id) {
        const { error } = await supabase.from("patients").update(payload).eq("id", form.id);
        if (error) throw error;
        return "updated";
      }

      const { error } = await supabase.from("patients").insert(payload as PatientInsert);
      if (error) throw error;
      return "created";
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient-statistics"] });
      setFormOpen(false);
      setEditingPatient(null);
      toast.success(result === "created" ? "Patient registered" : "Patient updated");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to save patient")),
  });

  const archivePatient = useMutation({
    mutationFn: async (patient: Patient) => {
      const { error } = await supabase
        .from("patients")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", patient.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient-statistics"] });
      toast.success("Patient archived");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to archive patient")),
  });

  const patients = useMemo(() => patientsQuery.data ?? [], [patientsQuery.data]);
  const stats = useMemo(() => statsQuery.data ?? [], [statsQuery.data]);
  const upcoming = useMemo(() => upcomingQuery.data ?? [], [upcomingQuery.data]);
  const statsByPatient = useMemo(() => new Map(stats.map((row) => [row.patient_id, row])), [stats]);
  const upcomingByPatient = useMemo(() => {
    const map = new Map<string, UpcomingAppointment>();
    for (const appointment of upcoming) {
      if (appointment.patient_id && !map.has(appointment.patient_id)) {
        map.set(appointment.patient_id, appointment);
      }
    }
    return map;
  }, [upcoming]);

  const filteredPatients = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return patients
      .filter((patient) => {
        const haystack = [
          patient.patient_code,
          patient.first_name,
          patient.last_name,
          patient.full_name,
          patient.phone,
          patient.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matchesSearch = !needle || haystack.includes(needle);
        const matchesGender = genderFilter === "all" || patient.gender === genderFilter;
        const matchesBlood = bloodGroupFilter === "all" || patient.blood_group === bloodGroupFilter;
        return matchesSearch && matchesGender && matchesBlood;
      })
      .sort((a, b) => {
        if (sortBy === "name") return patientName(a).localeCompare(patientName(b));
        if (sortBy === "patient_code") return a.patient_code.localeCompare(b.patient_code);
        if (sortBy === "last_visit") {
          const aLast = statsByPatient.get(a.id)?.last_visit_date ?? "";
          const bLast = statsByPatient.get(b.id)?.last_visit_date ?? "";
          return bLast.localeCompare(aLast);
        }
        return b.created_at.localeCompare(a.created_at);
      });
  }, [bloodGroupFilter, genderFilter, patients, search, sortBy, statsByPatient]);

  useEffect(() => {
    setPage(1);
  }, [bloodGroupFilter, genderFilter, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const visiblePatients = filteredPatients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const summary = buildSummary(patients, stats);
  const isLoading = patientsQuery.isLoading || statsQuery.isLoading || upcomingQuery.isLoading;
  const loadError = patientsQuery.error ?? statsQuery.error ?? upcomingQuery.error;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Records
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Patient Management</h1>
          </div>
          {canManagePatients && (
            <Button
              onClick={() => {
                setEditingPatient(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              Register patient
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Patients" value={summary.totalPatients} icon={<Users />} />
          <SummaryCard
            label="Upcoming Appts"
            value={summary.upcomingAppointments}
            icon={<CalendarDays />}
          />
          <SummaryCard
            label="Completed Visits"
            value={summary.completedAppointments}
            icon={<UserCheck />}
          />
          <SummaryCard
            label="Last Visit"
            value={summary.lastVisitDate ? formatDate(summary.lastVisitDate) : "None"}
            icon={<CalendarDays />}
          />
        </div>

        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border grid grid-cols-1 lg:grid-cols-[1fr_160px_160px_160px] gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, mobile, patient ID, or email"
                className="pl-9"
              />
            </div>
            <Select
              value={genderFilter}
              onValueChange={(value) => setGenderFilter(value as GenderFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genders</SelectItem>
                {GENDERS.map((gender) => (
                  <SelectItem key={gender} value={gender}>
                    {labelize(gender)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={bloodGroupFilter} onValueChange={setBloodGroupFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Blood group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All blood groups</SelectItem>
                {BLOOD_GROUPS.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortKey)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="patient_code">Patient ID</SelectItem>
                <SelectItem value="last_visit">Last visit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadError && (
            <div className="p-6 text-sm text-destructive">
              {getErrorMessage(loadError, "Unable to load patients")}
            </div>
          )}

          {!loadError && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      {[
                        "Patient ID",
                        "Full Name",
                        "Phone",
                        "Age",
                        "Gender",
                        "Last Visit",
                        "Upcoming Appointment",
                        "Actions",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className={`px-6 py-3 text-[10px] font-mono uppercase text-muted-foreground ${
                            heading === "Actions" ? "text-right" : ""
                          }`}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {isLoading &&
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index}>
                          <td colSpan={8} className="px-6 py-4">
                            <div className="h-10 rounded-md bg-muted animate-pulse" />
                          </td>
                        </tr>
                      ))}
                    {!isLoading &&
                      visiblePatients.map((patient) => (
                        <PatientRow
                          key={patient.id}
                          patient={patient}
                          stats={statsByPatient.get(patient.id)}
                          upcoming={upcomingByPatient.get(patient.id)}
                          canManage={canManagePatients}
                          canArchive={canArchivePatients}
                          onEdit={() => {
                            setEditingPatient(patient);
                            setFormOpen(true);
                          }}
                          onArchive={() => {
                            if (confirm(`Archive ${patientName(patient)}?`)) {
                              archivePatient.mutate(patient);
                            }
                          }}
                        />
                      ))}
                    {!isLoading && visiblePatients.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-6 py-12 text-center text-sm text-muted-foreground"
                        >
                          No patients match the current view.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-border">
                {isLoading &&
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="p-4">
                      <div className="h-24 rounded-md bg-muted animate-pulse" />
                    </div>
                  ))}
                {!isLoading &&
                  visiblePatients.map((patient) => (
                    <PatientMobileCard
                      key={patient.id}
                      patient={patient}
                      stats={statsByPatient.get(patient.id)}
                      upcoming={upcomingByPatient.get(patient.id)}
                      canManage={canManagePatients}
                      canArchive={canArchivePatients}
                      onEdit={() => {
                        setEditingPatient(patient);
                        setFormOpen(true);
                      }}
                      onArchive={() => {
                        if (confirm(`Archive ${patientName(patient)}?`)) {
                          archivePatient.mutate(patient);
                        }
                      }}
                    />
                  ))}
                {!isLoading && visiblePatients.length === 0 && (
                  <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No patients match the current view.
                  </div>
                )}
              </div>
            </>
          )}

          <div className="px-4 py-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>
              Showing {visiblePatients.length} of {filteredPatients.length} patients
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <span className="font-mono text-xs">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <PatientFormDialog
          open={formOpen}
          patient={editingPatient}
          isSaving={savePatient.isPending}
          onSave={(form) => savePatient.mutate(form)}
          onOpenChange={(open) => {
            setFormOpen(open);
            if (!open) setEditingPatient(null);
          }}
        />
      </div>
    </TooltipProvider>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <div className="bg-surface p-5 rounded-xl border border-border">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <div className="size-8 rounded-md bg-primary/10 text-primary flex items-center justify-center [&_svg]:size-4">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-semibold mt-2 tabular-nums">{value}</div>
    </div>
  );
}

function PatientRow({
  patient,
  stats,
  upcoming,
  canManage,
  canArchive,
  onEdit,
  onArchive,
}: {
  patient: Patient;
  stats?: PatientStats;
  upcoming?: UpcomingAppointment;
  canManage: boolean;
  canArchive: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <tr>
      <td className="px-6 py-4 font-mono text-xs">{patient.patient_code}</td>
      <td className="px-6 py-4">
        <div className="font-medium">{patientName(patient)}</div>
        <div className="text-xs text-muted-foreground">{patient.email ?? "No email"}</div>
      </td>
      <td className="px-6 py-4 text-muted-foreground">{patient.phone ?? "-"}</td>
      <td className="px-6 py-4 font-mono text-xs tabular-nums">
        {patient.date_of_birth ? calculateAge(patient.date_of_birth) : "-"}
      </td>
      <td className="px-6 py-4">
        {patient.gender ? (
          <Badge variant="outline" className="capitalize">
            {patient.gender}
          </Badge>
        ) : (
          "-"
        )}
      </td>
      <td className="px-6 py-4 text-muted-foreground">
        {stats?.last_visit_date ? formatDate(stats.last_visit_date) : "No visits"}
      </td>
      <td className="px-6 py-4 text-muted-foreground">
        {upcoming ? (
          <div>
            <div>{formatDate(upcoming.appointment_date)}</div>
            <div className="text-xs">
              {formatTime(upcoming.appointment_time)} · {upcoming.doctor?.name ?? "Unassigned"}
            </div>
          </div>
        ) : (
          "None scheduled"
        )}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="inline-flex gap-1">
          <ActionLink
            label="View"
            to="/patients/$patientId"
            patientId={patient.id}
            icon={<Eye />}
          />
          {canManage && <ActionButton label="Edit" onClick={onEdit} icon={<Pencil />} />}
          {canArchive && <ActionButton label="Archive" onClick={onArchive} icon={<Trash2 />} />}
        </div>
      </td>
    </tr>
  );
}

function PatientMobileCard({
  patient,
  stats,
  upcoming,
  canManage,
  canArchive,
  onEdit,
  onArchive,
}: {
  patient: Patient;
  stats?: PatientStats;
  upcoming?: UpcomingAppointment;
  canManage: boolean;
  canArchive: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{patientName(patient)}</div>
          <div className="font-mono text-xs text-muted-foreground">{patient.patient_code}</div>
        </div>
        {patient.gender && (
          <Badge variant="outline" className="capitalize">
            {patient.gender}
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <InfoPair label="Phone" value={patient.phone ?? "-"} />
        <InfoPair
          label="Age"
          value={patient.date_of_birth ? String(calculateAge(patient.date_of_birth)) : "-"}
        />
        <InfoPair
          label="Last Visit"
          value={stats?.last_visit_date ? formatDate(stats.last_visit_date) : "No visits"}
        />
        <InfoPair
          label="Upcoming"
          value={
            upcoming
              ? `${formatDate(upcoming.appointment_date)} ${formatTime(upcoming.appointment_time)}`
              : "None"
          }
        />
      </div>
      <div className="flex justify-end gap-1">
        <ActionLink label="View" to="/patients/$patientId" patientId={patient.id} icon={<Eye />} />
        {canManage && <ActionButton label="Edit" onClick={onEdit} icon={<Pencil />} />}
        {canArchive && <ActionButton label="Archive" onClick={onArchive} icon={<Trash2 />} />}
      </div>
    </div>
  );
}

function PatientFormDialog({
  open,
  patient,
  isSaving,
  onSave,
  onOpenChange,
}: {
  open: boolean;
  patient: Patient | null;
  isSaving: boolean;
  onSave: (form: PatientFormState) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<PatientFormState>(() => buildFormState(patient));

  useEffect(() => {
    if (open) setForm(buildFormState(patient));
  }, [open, patient]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{patient ? "Edit patient" : "Register patient"}</DialogTitle>
          <DialogDescription>
            Capture patient identity, contact, emergency, and medical summary details.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {patient && (
            <div className="md:col-span-2 rounded-md border border-border bg-muted/30 p-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Patient ID
              </span>
              <div className="font-mono text-sm mt-1">{patient.patient_code}</div>
            </div>
          )}

          <Field label="First Name" required>
            <Input
              value={form.firstName}
              onChange={(event) =>
                setForm((current) => ({ ...current, firstName: event.target.value }))
              }
              maxLength={80}
            />
          </Field>
          <Field label="Last Name" required>
            <Input
              value={form.lastName}
              onChange={(event) =>
                setForm((current) => ({ ...current, lastName: event.target.value }))
              }
              maxLength={80}
            />
          </Field>
          <Field label="Date of Birth" required>
            <Input
              type="date"
              value={form.dateOfBirth}
              max={todayKey()}
              onChange={(event) =>
                setForm((current) => ({ ...current, dateOfBirth: event.target.value }))
              }
            />
          </Field>
          <Field label="Gender" required>
            <Select
              value={form.gender}
              onValueChange={(gender) => setForm((current) => ({ ...current, gender }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((gender) => (
                  <SelectItem key={gender} value={gender}>
                    {labelize(gender)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Mobile" required>
            <Input
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
              maxLength={30}
              placeholder="+1 555 0100"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              maxLength={120}
            />
          </Field>
          <Field label="Blood Group">
            <Select
              value={form.bloodGroup || "none"}
              onValueChange={(bloodGroup) =>
                setForm((current) => ({
                  ...current,
                  bloodGroup: bloodGroup === "none" ? "" : bloodGroup,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select blood group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not recorded</SelectItem>
                {BLOOD_GROUPS.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Emergency Contact Name">
            <Input
              value={form.emergencyContactName}
              onChange={(event) =>
                setForm((current) => ({ ...current, emergencyContactName: event.target.value }))
              }
              maxLength={120}
            />
          </Field>
          <Field label="Emergency Contact Phone">
            <Input
              value={form.emergencyContactPhone}
              onChange={(event) =>
                setForm((current) => ({ ...current, emergencyContactPhone: event.target.value }))
              }
              maxLength={30}
            />
          </Field>
          <Field label="Address" className="md:col-span-2">
            <Textarea
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: event.target.value }))
              }
              rows={2}
              maxLength={400}
            />
          </Field>
          <Field label="Allergies" className="md:col-span-2">
            <Textarea
              value={form.allergies}
              onChange={(event) =>
                setForm((current) => ({ ...current, allergies: event.target.value }))
              }
              rows={2}
              maxLength={600}
              placeholder="Medication, food, environmental allergies"
            />
          </Field>
          <Field label="Current Medications" className="md:col-span-2">
            <Textarea
              value={form.currentMedications}
              onChange={(event) =>
                setForm((current) => ({ ...current, currentMedications: event.target.value }))
              }
              rows={2}
              maxLength={600}
            />
          </Field>
          <Field label="Medical History" className="md:col-span-2">
            <Textarea
              value={form.medicalHistory}
              onChange={(event) =>
                setForm((current) => ({ ...current, medicalHistory: event.target.value }))
              }
              rows={3}
              maxLength={1000}
            />
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <Textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              rows={3}
              maxLength={1000}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(form)} disabled={isSaving}>
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            {patient ? "Save changes" : "Register patient"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required = false,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" onClick={onClick} aria-label={label}>
          <span className="[&_svg]:size-4">{icon}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ActionLink({
  label,
  icon,
  to,
  patientId,
}: {
  label: string;
  icon: ReactNode;
  to: "/patients/$patientId";
  patientId: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" variant="ghost" asChild aria-label={label}>
          <Link to={to} params={{ patientId }}>
            <span className="[&_svg]:size-4">{icon}</span>
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-medium break-words">{value}</div>
    </div>
  );
}

function buildFormState(patient: Patient | null): PatientFormState {
  return {
    id: patient?.id,
    firstName: patient?.first_name ?? "",
    lastName: patient?.last_name ?? "",
    dateOfBirth: patient?.date_of_birth ?? patient?.dob ?? "",
    gender: patient?.gender ?? "",
    phone: patient?.phone ?? "",
    email: patient?.email ?? "",
    address: patient?.address ?? "",
    bloodGroup: patient?.blood_group ?? "",
    emergencyContactName: patient?.emergency_contact_name ?? "",
    emergencyContactPhone: patient?.emergency_contact_phone ?? "",
    allergies: patient?.allergies ?? "",
    currentMedications: patient?.current_medications ?? "",
    medicalHistory: patient?.medical_history ?? "",
    notes: patient?.notes ?? "",
  };
}

function buildPatientPayload(form: PatientFormState): PatientInsert | PatientUpdate {
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  return {
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim(),
    date_of_birth: form.dateOfBirth,
    dob: form.dateOfBirth,
    gender: form.gender,
    phone: nullable(form.phone),
    email: nullable(form.email),
    address: nullable(form.address),
    blood_group: nullable(form.bloodGroup),
    emergency_contact_name: nullable(form.emergencyContactName),
    emergency_contact_phone: nullable(form.emergencyContactPhone),
    allergies: nullable(form.allergies),
    current_medications: nullable(form.currentMedications),
    medical_history: nullable(form.medicalHistory),
    notes: nullable(form.notes),
  };
}

function validatePatientForm(form: PatientFormState) {
  if (!form.firstName.trim()) throw new Error("First name is required.");
  if (!form.lastName.trim()) throw new Error("Last name is required.");
  if (!form.dateOfBirth) throw new Error("Date of birth is required.");
  if (form.dateOfBirth > todayKey()) throw new Error("Date of birth cannot be in the future.");
  if (!form.gender) throw new Error("Gender is required.");
  if (!form.phone.trim()) throw new Error("Mobile number is required.");
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    throw new Error("Enter a valid email address.");
  }
}

function buildSummary(patients: Patient[], stats: PatientStats[]) {
  return {
    totalPatients: patients.length,
    upcomingAppointments: stats.reduce((sum, row) => sum + row.upcoming_appointments, 0),
    completedAppointments: stats.reduce((sum, row) => sum + row.completed_appointments, 0),
    lastVisitDate: stats
      .map((row) => row.last_visit_date)
      .filter((date): date is string => Boolean(date))
      .sort((a, b) => b.localeCompare(a))[0],
  };
}

function patientName(patient: Pick<Patient, "first_name" | "last_name" | "full_name">) {
  const composed = `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim();
  return composed || patient.full_name || "Unknown patient";
}

function calculateAge(dateOfBirth: string) {
  const birthDate = parseDateKey(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return Math.max(age, 0);
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function todayKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: string) {
  return parseDateKey(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}
