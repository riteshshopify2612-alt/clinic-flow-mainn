import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";
import { getErrorMessage } from "@/lib/error-message";

export const Route = createFileRoute("/_authenticated/patients/$patientId")({
  head: () => ({ meta: [{ title: "Patient Profile — CURA" }] }),
  component: PatientProfile,
});

type Patient = Tables<"patients">;
type PatientStats = Database["public"]["Views"]["patient_statistics"]["Row"];
type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
type PrescriptionStatus = Database["public"]["Enums"]["prescription_status"];
type MedicalNote = Tables<"patient_medical_notes">;
type PatientDocument = Tables<"patient_documents">;

type PatientAppointment = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  visit_reason: string | null;
  notes: string | null;
  doctor: { name: string; specialization: string } | null;
};

type PatientPrescription = {
  id: string;
  prescription_number: string;
  diagnosis: string | null;
  status: PrescriptionStatus;
  created_at: string;
  doctor: { name: string; specialization: string } | null;
};

type DocumentFormState = {
  file: File | null;
  documentType: string;
  notes: string;
};

const statusStyles: Record<AppointmentStatus, string> = {
  scheduled: "border-primary/20 bg-primary/10 text-primary",
  confirmed: "border-accent/20 bg-accent/10 text-accent-foreground",
  completed: "border-border bg-muted text-foreground",
  cancelled: "border-destructive/20 bg-destructive/10 text-destructive",
  no_show: "border-warning/20 bg-warning/10 text-warning",
};

const prescriptionStatusStyles: Record<PrescriptionStatus, string> = {
  draft: "border-warning/20 bg-warning/10 text-warning",
  finalized: "border-accent/20 bg-accent/10 text-accent-foreground",
  cancelled: "border-destructive/20 bg-destructive/10 text-destructive",
};

const DOCUMENT_TYPES = ["report", "prescription", "x_ray", "lab_report", "other"];
const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function PatientProfile() {
  const { patientId } = Route.useParams();
  const qc = useQueryClient();
  const { role } = useCurrentUser();
  const canAddMedicalNote = role === "admin" || role === "doctor";
  const canManageDocuments = role === "admin" || role === "receptionist";
  const [noteText, setNoteText] = useState("");
  const [editingNote, setEditingNote] = useState<MedicalNote | null>(null);
  const [documentForm, setDocumentForm] = useState<DocumentFormState>({
    file: null,
    documentType: "report",
    notes: "",
  });

  const patientQuery = useQuery({
    queryKey: ["patient", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .maybeSingle();

      if (error) throw error;
      return data as Patient | null;
    },
  });

  const statsQuery = useQuery({
    queryKey: ["patient-statistics", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_statistics")
        .select("*")
        .eq("patient_id", patientId)
        .maybeSingle();

      if (error) throw error;
      return data as PatientStats | null;
    },
  });

  const appointmentsQuery = useQuery({
    queryKey: ["patient-appointments", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          id,
          appointment_date,
          appointment_time,
          status,
          visit_reason,
          notes,
          doctor:doctors(name, specialization)
        `,
        )
        .eq("patient_id", patientId)
        .is("deleted_at", null)
        .order("appointment_date", { ascending: false })
        .order("appointment_time", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as PatientAppointment[];
    },
  });

  const notesQuery = useQuery({
    queryKey: ["patient-medical-notes", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_medical_notes")
        .select("*")
        .eq("patient_id", patientId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as MedicalNote[];
    },
  });

  const prescriptionsQuery = useQuery({
    queryKey: ["patient-prescriptions", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescriptions")
        .select(
          `
          id,
          prescription_number,
          diagnosis,
          status,
          created_at,
          doctor:doctors(name, specialization)
        `,
        )
        .eq("patient_id", patientId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as PatientPrescription[];
    },
  });

  const documentsQuery = useQuery({
    queryKey: ["patient-documents", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_documents")
        .select("*")
        .eq("patient_id", patientId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as PatientDocument[];
    },
  });

  const saveNote = useMutation({
    mutationFn: async () => {
      const note = noteText.trim();
      if (!note) throw new Error("Medical note cannot be empty.");

      if (editingNote) {
        const { error } = await supabase
          .from("patient_medical_notes")
          .update({ note })
          .eq("id", editingNote.id);
        if (error) throw error;
        return "updated";
      }

      const { error } = await supabase
        .from("patient_medical_notes")
        .insert({ patient_id: patientId, note });
      if (error) throw error;
      return "created";
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["patient-medical-notes", patientId] });
      setNoteText("");
      setEditingNote(null);
      toast.success(result === "created" ? "Medical note added" : "Medical note updated");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to save medical note")),
  });

  const uploadDocument = useMutation({
    mutationFn: async () => {
      if (!documentForm.file) throw new Error("Choose a document to upload.");
      if (!ALLOWED_DOCUMENT_TYPES.includes(documentForm.file.type)) {
        throw new Error("Only PDF, JPG, and PNG files are supported.");
      }

      const safeName = documentForm.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${patientId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("patient-documents")
        .upload(filePath, documentForm.file, {
          contentType: documentForm.file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { error } = await supabase.from("patient_documents").insert({
        patient_id: patientId,
        file_name: documentForm.file.name,
        file_path: filePath,
        document_type: documentForm.documentType,
        mime_type: documentForm.file.type,
        file_size: documentForm.file.size,
        notes: nullable(documentForm.notes),
      });

      if (error) {
        await supabase.storage.from("patient-documents").remove([filePath]);
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient-documents", patientId] });
      setDocumentForm({ file: null, documentType: "report", notes: "" });
      toast.success("Document uploaded");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to upload document")),
  });

  const openDocument = useMutation({
    mutationFn: async (document: PatientDocument) => {
      const { data, error } = await supabase.storage
        .from("patient-documents")
        .createSignedUrl(document.file_path, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to open document")),
  });

  const deleteDocument = useMutation({
    mutationFn: async (document: PatientDocument) => {
      const { error } = await supabase
        .from("patient_documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", document.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient-documents", patientId] });
      toast.success("Document deleted");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to delete document")),
  });

  const patient = patientQuery.data;
  const stats = statsQuery.data;
  const appointments = useMemo(() => appointmentsQuery.data ?? [], [appointmentsQuery.data]);
  const notes = useMemo(() => notesQuery.data ?? [], [notesQuery.data]);
  const prescriptions = useMemo(() => prescriptionsQuery.data ?? [], [prescriptionsQuery.data]);
  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
  const loadError =
    patientQuery.error ??
    statsQuery.error ??
    appointmentsQuery.error ??
    notesQuery.error ??
    prescriptionsQuery.error ??
    documentsQuery.error;
  const isLoading = patientQuery.isLoading || statsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 rounded-md bg-muted animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-96 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (loadError) {
    return (
      <ProfileMessage
        title="Unable to load patient"
        message={getErrorMessage(loadError, "Patient details could not be loaded.")}
      />
    );
  }

  if (!patient) {
    return (
      <ProfileMessage title="Patient not found" message="This patient record is unavailable." />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild className="-ml-2">
            <Link to="/patients">
              <ArrowLeft className="size-4" />
              Patients
            </Link>
          </Button>
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {patient.patient_code}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{patientName(patient)}</h1>
            <p className="text-sm text-muted-foreground">
              {patient.phone ?? "No phone"} {patient.email ? `· ${patient.email}` : ""}
            </p>
          </div>
        </div>
        {patient.blood_group && (
          <Badge variant="outline" className="text-sm px-3 py-1">
            Blood Group {patient.blood_group}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Appointments"
          value={stats?.total_appointments ?? 0}
          icon={<Users />}
        />
        <SummaryCard
          label="Upcoming"
          value={stats?.upcoming_appointments ?? 0}
          icon={<CalendarDays />}
        />
        <SummaryCard
          label="Completed"
          value={stats?.completed_appointments ?? 0}
          icon={<UserCheck />}
        />
        <SummaryCard
          label="Last Visit"
          value={stats?.last_visit_date ? formatDate(stats.last_visit_date) : "None"}
          icon={<CalendarDays />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <InfoSection title="Personal Information">
              <InfoRow label="Patient ID" value={patient.patient_code} />
              <InfoRow
                label="Date of Birth"
                value={patient.date_of_birth ? formatDate(patient.date_of_birth) : "-"}
              />
              <InfoRow
                label="Age"
                value={patient.date_of_birth ? String(calculateAge(patient.date_of_birth)) : "-"}
              />
              <InfoRow label="Gender" value={patient.gender ? labelize(patient.gender) : "-"} />
            </InfoSection>
            <InfoSection title="Contact Information">
              <InfoRow label="Phone" value={patient.phone ?? "-"} />
              <InfoRow label="Email" value={patient.email ?? "-"} />
              <InfoRow label="Address" value={patient.address ?? "-"} />
            </InfoSection>
            <InfoSection title="Medical Summary">
              <InfoRow label="Blood Group" value={patient.blood_group ?? "-"} />
              <InfoText label="Allergies" value={patient.allergies} />
              <InfoText label="Current Medications" value={patient.current_medications} />
              <InfoText label="Medical History" value={patient.medical_history} />
            </InfoSection>
            <InfoSection title="Emergency Contact">
              <InfoRow label="Name" value={patient.emergency_contact_name ?? "-"} />
              <InfoRow label="Phone" value={patient.emergency_contact_phone ?? "-"} />
              <InfoText label="Notes" value={patient.notes} />
            </InfoSection>
          </div>

          <Panel
            title="Visit History"
            description="Appointments linked through the existing patient_id relationship."
          >
            <div className="space-y-3">
              {appointmentsQuery.isLoading && (
                <div className="h-20 rounded-md bg-muted animate-pulse" />
              )}
              {!appointmentsQuery.isLoading &&
                appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-lg border border-border p-4 flex flex-col lg:flex-row lg:items-center gap-3 justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {formatDate(appointment.appointment_date)} at{" "}
                          {formatTime(appointment.appointment_time)}
                        </span>
                        <StatusBadge status={appointment.status} />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {appointment.doctor?.name ?? "Unassigned doctor"}
                        {appointment.doctor?.specialization
                          ? ` · ${appointment.doctor.specialization}`
                          : ""}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {appointment.visit_reason ??
                          appointment.notes ??
                          "No visit reason recorded."}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/appointments" search={{ appointmentId: appointment.id }}>
                        <ExternalLink className="size-4" />
                        Details
                      </Link>
                    </Button>
                  </div>
                ))}
              {!appointmentsQuery.isLoading && appointments.length === 0 && (
                <EmptyState label="No visit history recorded." />
              )}
            </div>
          </Panel>

          <Panel
            title="Prescription History"
            description="Previous prescriptions linked through encounters."
          >
            <div className="space-y-3">
              {prescriptionsQuery.isLoading && (
                <div className="h-20 rounded-md bg-muted animate-pulse" />
              )}
              {!prescriptionsQuery.isLoading &&
                prescriptions.map((prescription) => (
                  <div
                    key={prescription.id}
                    className="rounded-lg border border-border p-4 flex flex-col lg:flex-row lg:items-center gap-3 justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{prescription.prescription_number}</span>
                        <PrescriptionStatusBadge status={prescription.status} />
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(prescription.created_at)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {prescription.doctor?.name ?? "Unassigned doctor"}
                        {prescription.doctor?.specialization
                          ? ` · ${prescription.doctor.specialization}`
                          : ""}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {prescription.diagnosis ?? "No diagnosis recorded."}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/prescriptions" search={{ prescriptionId: prescription.id }}>
                        <ClipboardList className="size-4" />
                        Open
                      </Link>
                    </Button>
                  </div>
                ))}
              {!prescriptionsQuery.isLoading && prescriptions.length === 0 && (
                <EmptyState label="No prescriptions recorded." />
              )}
            </div>
          </Panel>

          <Panel title="Medical Records" description="Clinical notes with audit timestamps.">
            {canAddMedicalNote && (
              <div className="rounded-lg border border-border p-4 space-y-3 mb-4">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  {editingNote ? "Edit Medical Note" : "Add Medical Note"}
                </Label>
                <Textarea
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  rows={4}
                  maxLength={1200}
                  placeholder="Add diagnosis context, treatment notes, or follow-up observations"
                />
                <div className="flex justify-end gap-2">
                  {editingNote && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingNote(null);
                        setNoteText("");
                      }}
                    >
                      <X className="size-4" />
                      Cancel
                    </Button>
                  )}
                  <Button onClick={() => saveNote.mutate()} disabled={saveNote.isPending}>
                    {saveNote.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : editingNote ? (
                      <Save className="size-4" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    {editingNote ? "Save note" : "Add note"}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {notesQuery.isLoading && <div className="h-20 rounded-md bg-muted animate-pulse" />}
              {!notesQuery.isLoading &&
                notes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-border p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-mono text-muted-foreground">
                          Created {formatDateTime(note.created_at)}
                        </div>
                        {note.updated_at !== note.created_at && (
                          <div className="text-xs text-muted-foreground">
                            Updated {formatDateTime(note.updated_at)}
                          </div>
                        )}
                      </div>
                      {canAddMedicalNote && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit note"
                          onClick={() => {
                            setEditingNote(note);
                            setNoteText(note.note);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                    <div className="text-xs text-muted-foreground">
                      Created by {shortId(note.created_by)} · Updated by {shortId(note.updated_by)}
                    </div>
                  </div>
                ))}
              {!notesQuery.isLoading && notes.length === 0 && (
                <EmptyState label="No medical notes yet." />
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Documents" description="PDF, JPG, and PNG reports or prescriptions.">
            {canManageDocuments && (
              <div className="rounded-lg border border-border p-4 space-y-3 mb-4">
                <Field label="Document Type">
                  <Select
                    value={documentForm.documentType}
                    onValueChange={(documentType) =>
                      setDocumentForm((current) => ({ ...current, documentType }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {labelize(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="File">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={(event) =>
                      setDocumentForm((current) => ({
                        ...current,
                        file: event.target.files?.[0] ?? null,
                      }))
                    }
                  />
                </Field>
                <Field label="Notes">
                  <Textarea
                    value={documentForm.notes}
                    onChange={(event) =>
                      setDocumentForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    rows={2}
                    maxLength={400}
                  />
                </Field>
                <Button
                  className="w-full"
                  onClick={() => uploadDocument.mutate()}
                  disabled={uploadDocument.isPending}
                >
                  {uploadDocument.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Upload document
                </Button>
              </div>
            )}

            <div className="space-y-3">
              {documentsQuery.isLoading && (
                <div className="h-20 rounded-md bg-muted animate-pulse" />
              )}
              {!documentsQuery.isLoading &&
                documents.map((document) => (
                  <div key={document.id} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{document.file_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {labelize(document.document_type)} · {formatFileSize(document.file_size)}
                        </div>
                        {document.notes && (
                          <div className="text-sm text-muted-foreground mt-2">{document.notes}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDocument.mutate(document)}
                      >
                        <Download className="size-4" />
                        Open
                      </Button>
                      {canManageDocuments && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete ${document.file_name}?`)) {
                              deleteDocument.mutate(document);
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              {!documentsQuery.isLoading && documents.length === 0 && (
                <EmptyState label="No documents uploaded." />
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ProfileMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-10 text-center space-y-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild>
        <Link to="/patients">
          <ArrowLeft className="size-4" />
          Back to patients
        </Link>
      </Button>
    </div>
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

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
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

function InfoText({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <p className="whitespace-pre-wrap">{value || "-"}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      <FileText className="mx-auto mb-3 size-8 opacity-50" />
      {label}
    </div>
  );
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <Badge variant="outline" className={statusStyles[status]}>
      {labelize(status)}
    </Badge>
  );
}

function PrescriptionStatusBadge({ status }: { status: PrescriptionStatus }) {
  return (
    <Badge variant="outline" className={prescriptionStatusStyles[status]}>
      {labelize(status)}
    </Badge>
  );
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

function shortId(value: string | null) {
  return value ? value.slice(0, 8) : "system";
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFileSize(value: number | null) {
  if (!value) return "0 KB";
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
