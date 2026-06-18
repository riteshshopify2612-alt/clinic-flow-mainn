import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Download,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Save,
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
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { getErrorMessage } from "@/lib/error-message";
import {
  createPrescriptionPdfBlob,
  createPrescriptionPrintHtml,
  downloadBlob,
  type PrescriptionPdfData,
} from "@/lib/prescription-pdf";

export const Route = createFileRoute("/_authenticated/prescriptions")({
  validateSearch: (search: Record<string, unknown>) => {
    const parsed: {
      prescriptionId?: string;
      encounterId?: string;
      patientId?: string;
    } = {};
    if (typeof search.prescriptionId === "string") parsed.prescriptionId = search.prescriptionId;
    if (typeof search.encounterId === "string") parsed.encounterId = search.encounterId;
    if (typeof search.patientId === "string") parsed.patientId = search.patientId;
    return parsed;
  },
  head: () => ({ meta: [{ title: "Prescriptions - CURA" }] }),
  component: Prescriptions,
});

type PrescriptionStatus = Database["public"]["Enums"]["prescription_status"];
type Prescription = Tables<"prescriptions">;
type PrescriptionInsert = TablesInsert<"prescriptions">;
type PrescriptionUpdate = TablesUpdate<"prescriptions">;
type PrescriptionItem = Tables<"prescription_items">;
type PrescriptionTemplate = Tables<"prescription_templates">;
type PrescriptionTemplateItem = Tables<"prescription_template_items">;

type PatientSummary = {
  id: string;
  patient_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
};

type DoctorSummary = {
  id: string;
  name: string;
  specialization: string;
  email: string | null;
  phone: string | null;
  user_id: string | null;
};

type EncounterSummary = {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id: string | null;
  encounter_type: Database["public"]["Enums"]["encounter_type"];
  status: Database["public"]["Enums"]["encounter_status"];
  started_at: string;
  notes: string | null;
  patient: PatientSummary | null;
  doctor: DoctorSummary | null;
};

type PrescriptionRecord = Prescription & {
  patient: PatientSummary | null;
  doctor: DoctorSummary | null;
  encounter: Omit<EncounterSummary, "patient" | "doctor"> | null;
  items: PrescriptionItem[];
};

type TemplateRecord = PrescriptionTemplate & {
  items: PrescriptionTemplateItem[];
};

type ClinicProfile = {
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
};

type ItemFormState = {
  key: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  route: string;
  notes: string;
};

type PrescriptionFormState = {
  id?: string;
  status: PrescriptionStatus;
  patientId: string;
  encounterId: string;
  doctorId: string;
  diagnosis: string;
  chiefComplaint: string;
  clinicalNotes: string;
  instructions: string;
  items: ItemFormState[];
};

type SavePrescriptionInput = {
  form: PrescriptionFormState;
  status: PrescriptionStatus;
};

type StatusFilter = PrescriptionStatus | "all";

const PAGE_SIZE = 8;
const PRESCRIPTION_STATUSES: PrescriptionStatus[] = ["draft", "finalized", "cancelled"];

const statusStyles: Record<PrescriptionStatus, string> = {
  draft: "border-warning/20 bg-warning/10 text-warning",
  finalized: "border-accent/20 bg-accent/10 text-accent-foreground",
  cancelled: "border-destructive/20 bg-destructive/10 text-destructive",
};

function Prescriptions() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user, role } = useCurrentUser();
  const isAdmin = role === "admin";
  const isDoctor = role === "doctor";
  const canCreatePrescription = isAdmin || isDoctor;
  const [filters, setFilters] = useState({ search: "", status: "all" as StatusFilter });
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PrescriptionFormState>(() => emptyPrescriptionForm());
  const [detailId, setDetailId] = useState<string | null>(search.prescriptionId ?? null);
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("none");
  const [handledEncounterSearch, setHandledEncounterSearch] = useState<string | null>(null);

  useEffect(() => {
    if (search.prescriptionId) setDetailId(search.prescriptionId);
  }, [search.prescriptionId]);

  const currentDoctorQuery = useQuery({
    queryKey: ["current-doctor", user?.id],
    enabled: isDoctor && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id, name, specialization, email, phone, user_id")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DoctorSummary | null;
    },
  });

  const prescriptionsQuery = useQuery({
    queryKey: ["prescriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescriptions")
        .select(
          `
          id,
          prescription_number,
          patient_id,
          encounter_id,
          doctor_id,
          diagnosis,
          chief_complaint,
          clinical_notes,
          instructions,
          status,
          created_at,
          updated_at,
          deleted_at,
          created_by,
          updated_by,
          deleted_by,
          patient:patients(id, patient_code, first_name, last_name, full_name, phone, date_of_birth, gender),
          doctor:doctors(id, name, specialization, email, phone, user_id),
          encounter:patient_encounters(id, patient_id, doctor_id, appointment_id, encounter_type, status, started_at, notes)
        `,
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as Omit<PrescriptionRecord, "items">[];
    },
  });

  const prescriptionItemsQuery = useQuery({
    queryKey: ["prescription-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescription_items")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PrescriptionItem[];
    },
  });

  const patientsQuery = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, patient_code, first_name, last_name, full_name, phone, date_of_birth, gender")
        .is("deleted_at", null)
        .order("first_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PatientSummary[];
    },
  });

  const doctorsQuery = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id, name, specialization, email, phone, user_id")
        .is("deleted_at", null)
        .eq("status", "active")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DoctorSummary[];
    },
  });

  const encountersQuery = useQuery({
    queryKey: ["patient-encounters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_encounters")
        .select(
          `
          id,
          patient_id,
          doctor_id,
          appointment_id,
          encounter_type,
          status,
          started_at,
          notes,
          patient:patients(id, patient_code, first_name, last_name, full_name, phone, date_of_birth, gender),
          doctor:doctors(id, name, specialization, email, phone, user_id)
        `,
        )
        .is("deleted_at", null)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EncounterSummary[];
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["prescription-templates"],
    enabled: isAdmin || isDoctor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescription_templates")
        .select("*")
        .is("deleted_at", null)
        .order("is_system", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PrescriptionTemplate[];
    },
  });

  const templateItemsQuery = useQuery({
    queryKey: ["prescription-template-items"],
    enabled: isAdmin || isDoctor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescription_template_items")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PrescriptionTemplateItem[];
    },
  });

  const clinicQuery = useQuery({
    queryKey: ["clinic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_profile")
        .select("name, logo_url, address, phone, email")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ClinicProfile | null;
    },
  });

  const templates = useMemo(() => {
    const itemMap = groupBy(templateItemsQuery.data ?? [], (item) => item.template_id);
    return (templatesQuery.data ?? []).map((template) => ({
      ...template,
      items: itemMap.get(template.id) ?? [],
    }));
  }, [templateItemsQuery.data, templatesQuery.data]);

  const prescriptions = useMemo(() => {
    const itemMap = groupBy(prescriptionItemsQuery.data ?? [], (item) => item.prescription_id);
    return (prescriptionsQuery.data ?? []).map((prescription) => ({
      ...prescription,
      items: itemMap.get(prescription.id) ?? [],
    }));
  }, [prescriptionItemsQuery.data, prescriptionsQuery.data]);

  const currentDoctor = currentDoctorQuery.data ?? null;
  const selectedPrescription = prescriptions.find((item) => item.id === detailId) ?? null;

  useEffect(() => {
    if (!search.encounterId || handledEncounterSearch === search.encounterId) return;
    const encounter = (encountersQuery.data ?? []).find((item) => item.id === search.encounterId);
    if (!encounter) return;
    if (isDoctor && !currentDoctor) {
      toast.error("Your doctor profile is not linked to this login yet.");
      return;
    }
    setForm(
      emptyPrescriptionForm({
        doctorId: isDoctor ? currentDoctor?.id : encounter.doctor_id,
        patientId: encounter.patient_id,
        encounterId: encounter.id,
      }),
    );
    setSelectedTemplateId("none");
    setTemplateName("");
    setFormOpen(true);
    setHandledEncounterSearch(search.encounterId);
  }, [currentDoctor, encountersQuery.data, handledEncounterSearch, isDoctor, search.encounterId]);

  useEffect(() => {
    if (!search.patientId || formOpen) return;
    setForm((current) => ({ ...current, patientId: search.patientId ?? "" }));
  }, [formOpen, search.patientId]);

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.status]);

  const filteredPrescriptions = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    return prescriptions.filter((prescription) => {
      const patient = patientName(prescription.patient);
      const haystack = [
        prescription.prescription_number,
        patient,
        prescription.doctor?.name,
        prescription.diagnosis,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !needle || haystack.includes(needle);
      const matchesStatus = filters.status === "all" || prescription.status === filters.status;
      return matchesSearch && matchesStatus;
    });
  }, [filters.search, filters.status, prescriptions]);

  const totalPages = Math.max(1, Math.ceil(filteredPrescriptions.length / PAGE_SIZE));
  const pageItems = filteredPrescriptions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const today = todayKey();
    return prescriptions.reduce(
      (summary, prescription) => {
        if (prescription.created_at.slice(0, 10) === today) summary.today += 1;
        if (prescription.status === "draft") summary.drafts += 1;
        if (prescription.status === "finalized") summary.finalized += 1;
        if (prescription.status === "cancelled") summary.cancelled += 1;
        summary.total += 1;
        return summary;
      },
      { today: 0, total: 0, drafts: 0, finalized: 0, cancelled: 0 },
    );
  }, [prescriptions]);

  const savePrescription = useMutation({
    mutationFn: async ({ form: nextForm, status }: SavePrescriptionInput) => {
      validatePrescriptionForm(nextForm, status);
      const payload = buildPrescriptionPayload(nextForm, "draft");
      let prescriptionId = nextForm.id;

      if (prescriptionId) {
        const { error } = await supabase
          .from("prescriptions")
          .update(payload as PrescriptionUpdate)
          .eq("id", prescriptionId);
        if (error) throw error;

        const { error: archiveError } = await supabase
          .from("prescription_items")
          .update({ deleted_at: new Date().toISOString() })
          .eq("prescription_id", prescriptionId)
          .is("deleted_at", null);
        if (archiveError) throw archiveError;
      } else {
        const { data, error } = await supabase
          .from("prescriptions")
          .insert(payload as PrescriptionInsert)
          .select("id")
          .single();
        if (error) throw error;
        prescriptionId = data.id;
      }

      const items = nextForm.items.map((item) =>
        buildPrescriptionItemPayload(prescriptionId!, item),
      );
      const { error: itemError } = await supabase.from("prescription_items").insert(items);
      if (itemError) throw itemError;

      if (status !== "draft") {
        const { error: statusError } = await supabase
          .from("prescriptions")
          .update({ status })
          .eq("id", prescriptionId!);
        if (statusError) throw statusError;
      }

      return status;
    },
    onSuccess: (status) => {
      invalidatePrescriptionQueries(qc);
      setFormOpen(false);
      setSelectedTemplateId("none");
      setTemplateName("");
      toast.success(status === "finalized" ? "Prescription finalized" : "Prescription saved");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to save prescription")),
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      prescription,
      status,
    }: {
      prescription: PrescriptionRecord;
      status: PrescriptionStatus;
    }) => {
      if (status === "finalized")
        validatePrescriptionForm(toPrescriptionForm(prescription), status);
      const { error } = await supabase
        .from("prescriptions")
        .update({ status })
        .eq("id", prescription.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePrescriptionQueries(qc);
      toast.success("Prescription status updated");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to update prescription")),
  });

  const saveTemplate = useMutation({
    mutationFn: async () => {
      const name = templateName.trim();
      if (!name) throw new Error("Template name is required.");
      validateMedicineItems(form.items);

      const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
      const templatePayload = buildTemplatePayload(
        form,
        name,
        isDoctor ? currentDoctor?.id : form.doctorId,
      );
      let templateId = selectedTemplate?.id;

      if (selectedTemplate && !selectedTemplate.is_system) {
        const { error } = await supabase
          .from("prescription_templates")
          .update(templatePayload)
          .eq("id", selectedTemplate.id);
        if (error) throw error;
        const { error: archiveError } = await supabase
          .from("prescription_template_items")
          .update({ deleted_at: new Date().toISOString() })
          .eq("template_id", selectedTemplate.id)
          .is("deleted_at", null);
        if (archiveError) throw archiveError;
      } else {
        const { data, error } = await supabase
          .from("prescription_templates")
          .insert(templatePayload)
          .select("id")
          .single();
        if (error) throw error;
        templateId = data.id;
      }

      const items = form.items.map((item) => buildTemplateItemPayload(templateId!, item));
      const { error: itemError } = await supabase.from("prescription_template_items").insert(items);
      if (itemError) throw itemError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prescription-templates"] });
      qc.invalidateQueries({ queryKey: ["prescription-template-items"] });
      toast.success("Template saved");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to save template")),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (template: TemplateRecord) => {
      if (template.is_system && !isAdmin) throw new Error("System templates cannot be deleted.");
      const { error } = await supabase
        .from("prescription_templates")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", template.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prescription-templates"] });
      qc.invalidateQueries({ queryKey: ["prescription-template-items"] });
      setSelectedTemplateId("none");
      setTemplateName("");
      toast.success("Template deleted");
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to delete template")),
  });

  const storePdf = useMutation({
    mutationFn: async (prescription: PrescriptionRecord) => {
      ensureFinalized(prescription);
      const existing = await supabase
        .from("document_entity_links")
        .select("id")
        .eq("entity_type", "prescription")
        .eq("entity_id", prescription.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return "existing";

      const pdfData = buildPdfData(prescription, clinicQuery.data);
      const blob = createPrescriptionPdfBlob(pdfData);
      const safeNumber = prescription.prescription_number.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${prescription.patient_id}/prescriptions/${prescription.id}/${Date.now()}-${safeNumber}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("patient-documents")
        .upload(filePath, blob, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: document, error: documentError } = await supabase
        .from("patient_documents")
        .insert({
          patient_id: prescription.patient_id,
          file_name: `${prescription.prescription_number}.pdf`,
          file_path: filePath,
          document_type: "prescription",
          mime_type: "application/pdf",
          file_size: blob.size,
          notes: `Generated prescription ${prescription.prescription_number}`,
        })
        .select("id")
        .single();
      if (documentError) throw documentError;

      const { error: linkError } = await supabase.from("document_entity_links").insert({
        document_id: document.id,
        entity_type: "prescription",
        entity_id: prescription.id,
      });
      if (linkError) throw linkError;
      return "created";
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["patient-documents"] });
      toast.success(
        result === "existing" ? "Prescription PDF is already stored" : "PDF stored in documents",
      );
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to store prescription PDF")),
  });

  function openCreate(encounter?: EncounterSummary) {
    if (isDoctor && !currentDoctor) {
      toast.error("Your doctor profile is not linked to this login yet.");
      return;
    }

    setForm(
      emptyPrescriptionForm({
        doctorId: isDoctor ? currentDoctor?.id : encounter?.doctor_id,
        patientId: encounter?.patient_id ?? search.patientId,
        encounterId: encounter?.id,
      }),
    );
    setSelectedTemplateId("none");
    setTemplateName("");
    setFormOpen(true);
  }

  function openEdit(prescription: PrescriptionRecord) {
    setForm(toPrescriptionForm(prescription));
    setSelectedTemplateId("none");
    setTemplateName("");
    setFormOpen(true);
  }

  function loadTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setTemplateName(template.name);
    setForm((current) => ({
      ...current,
      diagnosis: template.diagnosis ?? "",
      chiefComplaint: template.chief_complaint ?? "",
      clinicalNotes: template.clinical_notes ?? "",
      instructions: template.instructions ?? "",
      items: template.items.length
        ? template.items.map(templateItemToForm)
        : [emptyPrescriptionItem()],
    }));
  }

  function printPrescription(prescription: PrescriptionRecord) {
    ensureFinalized(prescription);
    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      toast.error("Allow pop-ups to print the prescription.");
      return;
    }
    printWindow.document.write(
      createPrescriptionPrintHtml(buildPdfData(prescription, clinicQuery.data)),
    );
    printWindow.document.close();
    printWindow.focus();
  }

  function downloadPrescription(prescription: PrescriptionRecord) {
    ensureFinalized(prescription);
    const blob = createPrescriptionPdfBlob(buildPdfData(prescription, clinicQuery.data));
    downloadBlob(blob, `${prescription.prescription_number}.pdf`);
  }

  const isLoading =
    prescriptionsQuery.isLoading ||
    prescriptionItemsQuery.isLoading ||
    patientsQuery.isLoading ||
    doctorsQuery.isLoading ||
    encountersQuery.isLoading;
  const loadError =
    prescriptionsQuery.error ??
    prescriptionItemsQuery.error ??
    patientsQuery.error ??
    doctorsQuery.error ??
    encountersQuery.error ??
    templatesQuery.error ??
    templateItemsQuery.error;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Clinical
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Prescriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Encounter-linked prescriptions, medicines, templates, and official PDFs.
          </p>
        </div>
        {canCreatePrescription && (
          <Button onClick={() => openCreate()}>
            <Plus className="size-4" />
            New prescription
          </Button>
        )}
      </div>

      {isDoctor && !currentDoctorQuery.isLoading && !currentDoctor && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          Your doctor profile is not linked to this login. An admin must connect your user account
          to a doctor record before you can create prescriptions.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard label="Today" value={stats.today} />
        <SummaryCard label="Total" value={stats.total} />
        <SummaryCard label="Drafts" value={stats.drafts} />
        <SummaryCard label="Finalized" value={stats.finalized} />
        <SummaryCard label="Cancelled" value={stats.cancelled} />
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
              className="pl-9"
              placeholder="Search by prescription, patient, doctor, or diagnosis"
            />
          </div>
          <Select
            value={filters.status}
            onValueChange={(status) =>
              setFilters((current) => ({ ...current, status: status as StatusFilter }))
            }
          >
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PRESCRIPTION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loadError ? (
          <div className="p-10 text-center text-sm text-destructive">
            {getErrorMessage(loadError, "Prescriptions could not be loaded.")}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <TableHead>Prescription</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {isLoading &&
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index}>
                        <td colSpan={6} className="px-6 py-4">
                          <div className="h-6 rounded-md bg-muted animate-pulse" />
                        </td>
                      </tr>
                    ))}
                  {!isLoading &&
                    pageItems.map((prescription) => (
                      <tr key={prescription.id}>
                        <td className="px-6 py-4">
                          <div className="font-medium">{prescription.prescription_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDateTime(prescription.created_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium">{patientName(prescription.patient)}</div>
                          <div className="text-xs text-muted-foreground">
                            {prescription.patient?.patient_code ?? "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>{prescription.doctor?.name ?? "-"}</div>
                          <div className="text-xs text-muted-foreground">
                            {prescription.doctor?.specialization ?? ""}
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="truncate">{prescription.diagnosis ?? "-"}</div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={prescription.status} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="View prescription"
                              onClick={() => {
                                setDetailId(prescription.id);
                                navigate({
                                  to: "/prescriptions",
                                  search: { prescriptionId: prescription.id },
                                });
                              }}
                            >
                              <Eye className="size-4" />
                            </Button>
                            {canEditPrescription(prescription, currentDoctor, role) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Edit prescription"
                                onClick={() => openEdit(prescription)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Download PDF"
                              disabled={prescription.status !== "finalized"}
                              onClick={() => downloadPrescription(prescription)}
                            >
                              <Download className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {!isLoading && pageItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                        No prescriptions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <PrescriptionDialog
        open={formOpen}
        form={form}
        setForm={setForm}
        patients={patientsQuery.data ?? []}
        doctors={doctorsQuery.data ?? []}
        encounters={encountersQuery.data ?? []}
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        templateName={templateName}
        setTemplateName={setTemplateName}
        currentDoctor={currentDoctor}
        role={role}
        isSaving={savePrescription.isPending}
        isSavingTemplate={saveTemplate.isPending}
        isDeletingTemplate={deleteTemplate.isPending}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setSelectedTemplateId("none");
            setTemplateName("");
          }
        }}
        onSave={(status) => savePrescription.mutate({ form, status })}
        onLoadTemplate={loadTemplate}
        onSaveTemplate={() => saveTemplate.mutate()}
        onDeleteTemplate={(template) => deleteTemplate.mutate(template)}
      />

      <PrescriptionDetailsDialog
        prescription={selectedPrescription}
        currentDoctor={currentDoctor}
        role={role}
        isUpdatingStatus={updateStatus.isPending}
        isStoringPdf={storePdf.isPending}
        onClose={() => {
          setDetailId(null);
          navigate({ to: "/prescriptions", search: {} });
        }}
        onEdit={openEdit}
        onFinalize={(prescription) => updateStatus.mutate({ prescription, status: "finalized" })}
        onCancelPrescription={(prescription) =>
          updateStatus.mutate({ prescription, status: "cancelled" })
        }
        onDownload={downloadPrescription}
        onPrint={printPrescription}
        onStore={(prescription) => storePdf.mutate(prescription)}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-surface p-5 rounded-xl border border-border">
      <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <div className="text-2xl font-semibold mt-2 tabular-nums">{value}</div>
    </div>
  );
}

function TableHead({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th className={`px-6 py-3 text-[10px] font-mono uppercase text-muted-foreground ${className}`}>
      {children}
    </th>
  );
}

function PrescriptionDialog({
  open,
  form,
  setForm,
  patients,
  doctors,
  encounters,
  templates,
  selectedTemplateId,
  templateName,
  setTemplateName,
  currentDoctor,
  role,
  isSaving,
  isSavingTemplate,
  isDeletingTemplate,
  onOpenChange,
  onSave,
  onLoadTemplate,
  onSaveTemplate,
  onDeleteTemplate,
}: {
  open: boolean;
  form: PrescriptionFormState;
  setForm: (updater: (current: PrescriptionFormState) => PrescriptionFormState) => void;
  patients: PatientSummary[];
  doctors: DoctorSummary[];
  encounters: EncounterSummary[];
  templates: TemplateRecord[];
  selectedTemplateId: string;
  templateName: string;
  setTemplateName: (value: string) => void;
  currentDoctor: DoctorSummary | null;
  role: string | null;
  isSaving: boolean;
  isSavingTemplate: boolean;
  isDeletingTemplate: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (status: PrescriptionStatus) => void;
  onLoadTemplate: (templateId: string) => void;
  onSaveTemplate: () => void;
  onDeleteTemplate: (template: TemplateRecord) => void;
}) {
  const isEdit = Boolean(form.id);
  const isDoctor = role === "doctor";
  const saveStatus = isEdit ? form.status : "draft";
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const availableEncounters = encounters.filter((encounter) => {
    if (form.patientId && encounter.patient_id !== form.patientId) return false;
    if (isDoctor && currentDoctor && encounter.doctor_id !== currentDoctor.id) return false;
    return true;
  });

  function update<K extends keyof PrescriptionFormState>(key: K, value: PrescriptionFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateItem(index: number, patch: Partial<ItemFormState>) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  function removeItem(index: number) {
    setForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? [emptyPrescriptionItem()]
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit prescription" : "Create prescription"}</DialogTitle>
          <DialogDescription>
            Link the prescription to a patient encounter and add medicines.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Patient">
                <Select
                  value={form.patientId || "none"}
                  onValueChange={(patientId) =>
                    setForm((current) => ({
                      ...current,
                      patientId: patientId === "none" ? "" : patientId,
                      encounterId:
                        patientId === "none" ||
                        !encounters.some(
                          (encounter) =>
                            encounter.id === current.encounterId &&
                            encounter.patient_id === patientId,
                        )
                          ? ""
                          : current.encounterId,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select patient" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select patient</SelectItem>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patientName(patient)} - {patient.patient_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Doctor">
                <Select
                  value={form.doctorId || "none"}
                  disabled={isDoctor}
                  onValueChange={(doctorId) =>
                    update("doctorId", doctorId === "none" ? "" : doctorId)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select doctor</SelectItem>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name} - {doctor.specialization}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="md:col-span-2">
                <Field label="Patient Encounter">
                  <Select
                    value={form.encounterId || "none"}
                    onValueChange={(encounterId) => {
                      const encounter = encounters.find((item) => item.id === encounterId);
                      setForm((current) => ({
                        ...current,
                        encounterId: encounterId === "none" ? "" : encounterId,
                        patientId: encounter?.patient_id ?? current.patientId,
                        doctorId:
                          isDoctor && currentDoctor
                            ? currentDoctor.id
                            : (encounter?.doctor_id ?? current.doctorId),
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select encounter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select encounter</SelectItem>
                      {availableEncounters.map((encounter) => (
                        <SelectItem key={encounter.id} value={encounter.id}>
                          {formatDateTime(encounter.started_at)} -{" "}
                          {labelize(encounter.encounter_type)} - {patientName(encounter.patient)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Chief Complaint">
                <Input
                  value={form.chiefComplaint}
                  maxLength={240}
                  onChange={(event) => update("chiefComplaint", event.target.value)}
                />
              </Field>
              <Field label="Diagnosis">
                <Input
                  value={form.diagnosis}
                  maxLength={240}
                  onChange={(event) => update("diagnosis", event.target.value)}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Clinical Notes">
                  <Textarea
                    value={form.clinicalNotes}
                    rows={3}
                    maxLength={1200}
                    onChange={(event) => update("clinicalNotes", event.target.value)}
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Instructions">
                  <Textarea
                    value={form.instructions}
                    rows={3}
                    maxLength={1200}
                    onChange={(event) => update("instructions", event.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Medicines
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      items: [...current.items, emptyPrescriptionItem()],
                    }))
                  }
                >
                  <Plus className="size-4" />
                  Add medicine
                </Button>
              </div>
              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div key={item.key} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex justify-between gap-3">
                      <span className="text-sm font-medium">Medicine {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove medicine"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Medicine Name">
                        <Input
                          value={item.medicineName}
                          maxLength={180}
                          onChange={(event) =>
                            updateItem(index, { medicineName: event.target.value })
                          }
                        />
                      </Field>
                      <Field label="Dosage">
                        <Input
                          value={item.dosage}
                          maxLength={80}
                          onChange={(event) => updateItem(index, { dosage: event.target.value })}
                        />
                      </Field>
                      <Field label="Frequency">
                        <Input
                          value={item.frequency}
                          maxLength={120}
                          onChange={(event) => updateItem(index, { frequency: event.target.value })}
                        />
                      </Field>
                      <Field label="Duration">
                        <Input
                          value={item.duration}
                          maxLength={120}
                          onChange={(event) => updateItem(index, { duration: event.target.value })}
                        />
                      </Field>
                      <Field label="Quantity">
                        <Input
                          value={item.quantity}
                          maxLength={80}
                          onChange={(event) => updateItem(index, { quantity: event.target.value })}
                        />
                      </Field>
                      <Field label="Route">
                        <Input
                          value={item.route}
                          maxLength={80}
                          onChange={(event) => updateItem(index, { route: event.target.value })}
                        />
                      </Field>
                      <div className="md:col-span-2">
                        <Field label="Notes">
                          <Textarea
                            value={item.notes}
                            rows={2}
                            maxLength={400}
                            onChange={(event) => updateItem(index, { notes: event.target.value })}
                          />
                        </Field>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border p-4 space-y-4">
              <div>
                <h3 className="font-semibold">Templates</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Load common diagnosis and medicine sets.
                </p>
              </div>
              <Field label="Load Template">
                <Select value={selectedTemplateId} onValueChange={onLoadTemplate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose template</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                        {template.is_system ? " (System)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Template Name">
                <Input
                  value={templateName}
                  maxLength={120}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="Save current prescription as template"
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isSavingTemplate}
                onClick={onSaveTemplate}
              >
                {isSavingTemplate ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                {selectedTemplate && !selectedTemplate.is_system
                  ? "Update template"
                  : "Save template"}
              </Button>
              {selectedTemplate && (!selectedTemplate.is_system || role === "admin") && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive"
                  disabled={isDeletingTemplate}
                  onClick={() => onDeleteTemplate(selectedTemplate)}
                >
                  {isDeletingTemplate ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Delete template
                </Button>
              )}
            </div>

            <div className="rounded-xl border border-border p-4 text-xs text-muted-foreground leading-relaxed">
              Only finalized prescriptions can be printed, downloaded, or stored as official
              documents.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => onSave(saveStatus)} disabled={isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isEdit && form.status !== "draft" ? "Save changes" : "Save draft"}
          </Button>
          <Button onClick={() => onSave("finalized")} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            Finalize
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrescriptionDetailsDialog({
  prescription,
  currentDoctor,
  role,
  isUpdatingStatus,
  isStoringPdf,
  onClose,
  onEdit,
  onFinalize,
  onCancelPrescription,
  onDownload,
  onPrint,
  onStore,
}: {
  prescription: PrescriptionRecord | null;
  currentDoctor: DoctorSummary | null;
  role: string | null;
  isUpdatingStatus: boolean;
  isStoringPdf: boolean;
  onClose: () => void;
  onEdit: (prescription: PrescriptionRecord) => void;
  onFinalize: (prescription: PrescriptionRecord) => void;
  onCancelPrescription: (prescription: PrescriptionRecord) => void;
  onDownload: (prescription: PrescriptionRecord) => void;
  onPrint: (prescription: PrescriptionRecord) => void;
  onStore: (prescription: PrescriptionRecord) => void;
}) {
  const open = Boolean(prescription);
  const canEdit = prescription ? canEditPrescription(prescription, currentDoctor, role) : false;
  const canFinalize =
    prescription?.status === "draft" && canEditPrescription(prescription, currentDoctor, role);
  const canCancel =
    Boolean(prescription) &&
    prescription!.status !== "cancelled" &&
    (role === "admin" || (role === "doctor" && currentDoctor?.id === prescription!.doctor_id));
  const canGenerateDocument =
    Boolean(prescription) && prescription!.status === "finalized" && role !== "receptionist";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {prescription && (
          <>
            <DialogHeader>
              <DialogTitle>{prescription.prescription_number}</DialogTitle>
              <DialogDescription>
                {patientName(prescription.patient)} - {formatDateTime(prescription.created_at)}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <InfoBlock title="Patient">
                <InfoRow label="Name" value={patientName(prescription.patient)} />
                <InfoRow label="Code" value={prescription.patient?.patient_code ?? "-"} />
                <InfoRow label="Phone" value={prescription.patient?.phone ?? "-"} />
              </InfoBlock>
              <InfoBlock title="Doctor">
                <InfoRow label="Name" value={prescription.doctor?.name ?? "-"} />
                <InfoRow
                  label="Specialization"
                  value={prescription.doctor?.specialization ?? "-"}
                />
              </InfoBlock>
              <InfoBlock title="Prescription">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <StatusBadge status={prescription.status} />
                </div>
                <InfoRow
                  label="Encounter"
                  value={
                    prescription.encounter
                      ? `${labelize(prescription.encounter.encounter_type)} - ${formatDateTime(
                          prescription.encounter.started_at,
                        )}`
                      : "-"
                  }
                />
              </InfoBlock>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InfoBlock title="Clinical Details">
                <InfoText label="Chief Complaint" value={prescription.chief_complaint} />
                <InfoText label="Diagnosis" value={prescription.diagnosis} />
                <InfoText label="Clinical Notes" value={prescription.clinical_notes} />
              </InfoBlock>
              <InfoBlock title="Instructions">
                <InfoText label="Instructions" value={prescription.instructions} />
              </InfoBlock>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-semibold">Medicines</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <TableHead>Medicine</TableHead>
                      <TableHead>Dosage</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Qty</TableHead>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {prescription.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4">
                          <div className="font-medium">{item.medicine_name}</div>
                          {item.notes && (
                            <div className="text-xs text-muted-foreground mt-1">{item.notes}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">{item.dosage}</td>
                        <td className="px-6 py-4">{item.frequency}</td>
                        <td className="px-6 py-4">{item.duration}</td>
                        <td className="px-6 py-4">{item.quantity ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {canEdit && (
                <Button variant="outline" onClick={() => onEdit(prescription)}>
                  <Pencil className="size-4" />
                  Edit
                </Button>
              )}
              {canFinalize && (
                <Button onClick={() => onFinalize(prescription)} disabled={isUpdatingStatus}>
                  {isUpdatingStatus ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                  Finalize
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onCancelPrescription(prescription)}
                  disabled={isUpdatingStatus}
                >
                  <XCircle className="size-4" />
                  Cancel
                </Button>
              )}
              <Button
                variant="outline"
                disabled={prescription.status !== "finalized"}
                onClick={() => onPrint(prescription)}
              >
                <Printer className="size-4" />
                Print
              </Button>
              <Button
                variant="outline"
                disabled={prescription.status !== "finalized"}
                onClick={() => onDownload(prescription)}
              >
                <Download className="size-4" />
                Download
              </Button>
              {canGenerateDocument && (
                <Button
                  variant="outline"
                  disabled={isStoringPdf}
                  onClick={() => onStore(prescription)}
                >
                  {isStoringPdf ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Store PDF
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
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

function InfoBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
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
      <span className="text-muted-foreground">{label}</span>
      <span className="col-span-2 break-words">{value}</span>
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

function StatusBadge({ status }: { status: PrescriptionStatus }) {
  return (
    <Badge variant="outline" className={statusStyles[status]}>
      {statusLabel(status)}
    </Badge>
  );
}

function canEditPrescription(
  prescription: PrescriptionRecord,
  currentDoctor: DoctorSummary | null,
  role: string | null,
) {
  if (role === "admin") return true;
  if (role !== "doctor" || prescription.status !== "draft") return false;
  return currentDoctor?.id === prescription.doctor_id;
}

function validatePrescriptionForm(form: PrescriptionFormState, status: PrescriptionStatus) {
  if (!form.patientId) throw new Error("Patient is required.");
  if (!form.doctorId) throw new Error("Doctor is required.");
  if (!form.encounterId) throw new Error("Patient encounter is required.");
  if (status === "finalized" && !form.diagnosis.trim()) {
    throw new Error("Diagnosis is required before finalizing.");
  }
  validateMedicineItems(form.items);
}

function validateMedicineItems(items: ItemFormState[]) {
  if (items.length === 0) throw new Error("Add at least one medicine.");
  for (const [index, item] of items.entries()) {
    if (!item.medicineName.trim()) throw new Error(`Medicine ${index + 1} name is required.`);
    if (!item.dosage.trim()) throw new Error(`Medicine ${index + 1} dosage is required.`);
    if (!item.frequency.trim()) throw new Error(`Medicine ${index + 1} frequency is required.`);
    if (!item.duration.trim()) throw new Error(`Medicine ${index + 1} duration is required.`);
  }
}

function ensureFinalized(prescription: PrescriptionRecord) {
  if (prescription.status !== "finalized") {
    throw new Error("Only finalized prescriptions can generate official PDFs.");
  }
}

function buildPrescriptionPayload(
  form: PrescriptionFormState,
  status: PrescriptionStatus,
): PrescriptionInsert | PrescriptionUpdate {
  return {
    patient_id: form.patientId,
    encounter_id: form.encounterId,
    doctor_id: form.doctorId,
    diagnosis: nullable(form.diagnosis),
    chief_complaint: nullable(form.chiefComplaint),
    clinical_notes: nullable(form.clinicalNotes),
    instructions: nullable(form.instructions),
    status,
  };
}

function buildPrescriptionItemPayload(prescriptionId: string, item: ItemFormState) {
  return {
    prescription_id: prescriptionId,
    medicine_name: item.medicineName.trim(),
    dosage: item.dosage.trim(),
    frequency: item.frequency.trim(),
    duration: item.duration.trim(),
    quantity: nullable(item.quantity),
    route: nullable(item.route),
    notes: nullable(item.notes),
  };
}

function buildTemplatePayload(form: PrescriptionFormState, name: string, doctorId?: string | null) {
  return {
    name,
    doctor_id: doctorId || null,
    diagnosis: nullable(form.diagnosis),
    chief_complaint: nullable(form.chiefComplaint),
    clinical_notes: nullable(form.clinicalNotes),
    instructions: nullable(form.instructions),
    is_system: false,
  };
}

function buildTemplateItemPayload(templateId: string, item: ItemFormState) {
  return {
    template_id: templateId,
    medicine_name: item.medicineName.trim(),
    dosage: item.dosage.trim(),
    frequency: item.frequency.trim(),
    duration: item.duration.trim(),
    quantity: nullable(item.quantity),
    route: nullable(item.route),
    notes: nullable(item.notes),
  };
}

function buildPdfData(
  prescription: PrescriptionRecord,
  clinic: ClinicProfile | null | undefined,
): PrescriptionPdfData {
  return {
    clinic: {
      name: clinic?.name ?? "CURA Clinic",
      logoUrl: clinic?.logo_url,
      address: clinic?.address,
      phone: clinic?.phone,
      email: clinic?.email,
    },
    doctor: {
      name: prescription.doctor?.name ?? "Doctor",
      specialization: prescription.doctor?.specialization,
      qualification: prescription.doctor?.specialization,
    },
    patient: {
      name: patientName(prescription.patient),
      code: prescription.patient?.patient_code ?? "-",
      phone: prescription.patient?.phone,
      dateOfBirth: prescription.patient?.date_of_birth
        ? formatDate(prescription.patient.date_of_birth)
        : null,
      gender: prescription.patient?.gender ? labelize(prescription.patient.gender) : null,
    },
    prescription: {
      number: prescription.prescription_number,
      date: formatDateTime(prescription.created_at),
      diagnosis: prescription.diagnosis,
      chiefComplaint: prescription.chief_complaint,
      clinicalNotes: prescription.clinical_notes,
      instructions: prescription.instructions,
    },
    items: prescription.items.map((item) => ({
      medicineName: item.medicine_name,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      quantity: item.quantity,
      route: item.route,
      notes: item.notes,
    })),
  };
}

function toPrescriptionForm(prescription: PrescriptionRecord): PrescriptionFormState {
  return {
    id: prescription.id,
    status: prescription.status,
    patientId: prescription.patient_id,
    encounterId: prescription.encounter_id,
    doctorId: prescription.doctor_id,
    diagnosis: prescription.diagnosis ?? "",
    chiefComplaint: prescription.chief_complaint ?? "",
    clinicalNotes: prescription.clinical_notes ?? "",
    instructions: prescription.instructions ?? "",
    items: prescription.items.length
      ? prescription.items.map(prescriptionItemToForm)
      : [emptyPrescriptionItem()],
  };
}

function emptyPrescriptionForm(
  defaults: Partial<PrescriptionFormState> = {},
): PrescriptionFormState {
  return {
    status: defaults.status ?? "draft",
    patientId: defaults.patientId ?? "",
    encounterId: defaults.encounterId ?? "",
    doctorId: defaults.doctorId ?? "",
    diagnosis: "",
    chiefComplaint: "",
    clinicalNotes: "",
    instructions: "",
    items: [emptyPrescriptionItem()],
  };
}

function emptyPrescriptionItem(): ItemFormState {
  return {
    key: createClientKey(),
    medicineName: "",
    dosage: "",
    frequency: "",
    duration: "",
    quantity: "",
    route: "",
    notes: "",
  };
}

function prescriptionItemToForm(item: PrescriptionItem): ItemFormState {
  return {
    key: item.id,
    medicineName: item.medicine_name,
    dosage: item.dosage,
    frequency: item.frequency,
    duration: item.duration,
    quantity: item.quantity ?? "",
    route: item.route ?? "",
    notes: item.notes ?? "",
  };
}

function templateItemToForm(item: PrescriptionTemplateItem): ItemFormState {
  return {
    key: item.id,
    medicineName: item.medicine_name,
    dosage: item.dosage,
    frequency: item.frequency,
    duration: item.duration,
    quantity: item.quantity ?? "",
    route: item.route ?? "",
    notes: item.notes ?? "",
  };
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const group = map.get(key);
    if (group) group.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function invalidatePrescriptionQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["prescriptions"] });
  qc.invalidateQueries({ queryKey: ["prescription-items"] });
  qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  qc.invalidateQueries({ queryKey: ["patient-prescriptions"] });
}

function patientName(patient: PatientSummary | null | undefined) {
  if (!patient) return "Unknown patient";
  const composed = `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim();
  return composed || patient.full_name || "Unknown patient";
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function createClientKey() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function statusLabel(status: PrescriptionStatus) {
  const labels: Record<PrescriptionStatus, string> = {
    draft: "Draft",
    finalized: "Finalized",
    cancelled: "Cancelled",
  };
  return labels[status];
}

function labelize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}
