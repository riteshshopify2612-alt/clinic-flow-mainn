import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CURA" }] }),
  component: Dashboard,
});

type DashboardDoctor = {
  id: string;
  name: string;
  specialization: string;
  working_hours: { open?: string; close?: string } | null;
  status: string;
};

type RevenueRow = {
  doctor: { consultation_fee: number | string | null } | null;
};

type TodayAppointment = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  visit_reason: string | null;
  notes: string | null;
  patient: {
    first_name: string;
    last_name: string;
    full_name: string;
    patient_code: string;
  } | null;
  doctor: { name: string } | null;
};

type PrescriptionStatus = Database["public"]["Enums"]["prescription_status"];

type RecentPrescription = {
  id: string;
  prescription_number: string;
  diagnosis: string | null;
  status: PrescriptionStatus;
  created_at: string;
  patient: {
    first_name: string;
    last_name: string;
    full_name: string;
    patient_code: string;
  } | null;
  doctor: { name: string } | null;
};

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

function formatAppointmentTime(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function patientName(patient: TodayAppointment["patient"]) {
  if (!patient) return "Unknown patient";
  const composed = `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim();
  return composed || patient.full_name || "Unknown patient";
}

function Dashboard() {
  const { user, role } = useCurrentUser();
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", role, user?.id],
    queryFn: async () => {
      let currentDoctorId: string | null = null;
      if (role === "doctor" && user?.id) {
        const { data: doctor } = await supabase
          .from("doctors")
          .select("id")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .maybeSingle();
        currentDoctorId = doctor?.id ?? null;
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);

      const prescriptionTodayQuery = supabase
        .from("prescriptions")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", tomorrowStart.toISOString());
      const prescriptionTotalQuery = supabase
        .from("prescriptions")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null);
      const prescriptionDraftQuery = supabase
        .from("prescriptions")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("status", "draft");
      const recentPrescriptionsQuery = supabase
        .from("prescriptions")
        .select(
          "id, prescription_number, diagnosis, status, created_at, patient:patients(first_name, last_name, full_name, patient_code), doctor:doctors(name)",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);

      if (role === "doctor") {
        if (currentDoctorId) {
          prescriptionTodayQuery.eq("doctor_id", currentDoctorId);
          prescriptionTotalQuery.eq("doctor_id", currentDoctorId);
          prescriptionDraftQuery.eq("doctor_id", currentDoctorId);
          recentPrescriptionsQuery.eq("doctor_id", currentDoctorId);
        } else {
          return {
            totalPatients: 0,
            todayCount: 0,
            upcomingCount: 0,
            revenue: 0,
            activeDoctors: 0,
            doctors: [] as DashboardDoctor[],
            todayList: [] as TodayAppointment[],
            prescriptionsToday: 0,
            totalPrescriptions: 0,
            pendingDrafts: 0,
            recentPrescriptions: [] as RecentPrescription[],
          };
        }
      }

      const [patients, todayAppts, upcoming, revenue, doctors, todayList] = await Promise.all([
        supabase
          .from("patients")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null),
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .eq("appointment_date", dateKey()),
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .gt("appointment_date", dateKey())
          .lte("appointment_date", inDays(7))
          .in("status", ["scheduled", "confirmed"]),
        supabase
          .from("appointments")
          .select("doctor:doctors(consultation_fee)")
          .is("deleted_at", null)
          .eq("status", "completed"),
        supabase
          .from("doctors")
          .select("id, name, specialization, working_hours, status")
          .is("deleted_at", null)
          .eq("status", "active"),
        supabase
          .from("appointments")
          .select(
            "id, appointment_date, appointment_time, status, visit_reason, notes, patient:patients(first_name, last_name, full_name, patient_code), doctor:doctors(name)",
          )
          .is("deleted_at", null)
          .eq("appointment_date", dateKey())
          .order("appointment_time", { ascending: true })
          .limit(5),
      ]);

      const [prescriptionToday, prescriptionTotal, prescriptionDrafts, recentPrescriptions] =
        await Promise.all([
          prescriptionTodayQuery,
          prescriptionTotalQuery,
          prescriptionDraftQuery,
          recentPrescriptionsQuery,
        ]);

      const revenueRows = (revenue.data ?? []) as unknown as RevenueRow[];
      const activeDoctors = (doctors.data ?? []) as unknown as DashboardDoctor[];
      const todayAppointments = (todayList.data ?? []) as unknown as TodayAppointment[];
      const recentPrescriptionRows = (recentPrescriptions.data ??
        []) as unknown as RecentPrescription[];
      const totalRevenue = revenueRows.reduce(
        (sum, row) => sum + Number(row.doctor?.consultation_fee ?? 0),
        0,
      );

      return {
        totalPatients: patients.count ?? 0,
        todayCount: todayAppts.count ?? 0,
        upcomingCount: upcoming.count ?? 0,
        revenue: totalRevenue,
        activeDoctors: activeDoctors.length,
        doctors: activeDoctors,
        todayList: todayAppointments,
        prescriptionsToday: prescriptionToday.count ?? 0,
        totalPrescriptions: prescriptionTotal.count ?? 0,
        pendingDrafts: prescriptionDrafts.count ?? 0,
        recentPrescriptions: recentPrescriptionRows,
      };
    },
  });

  const tiles = [
    { label: "Total Patients", value: stats?.totalPatients ?? 0, hint: "All time" },
    { label: "Today's Appts", value: stats?.todayCount ?? 0, hint: "Scheduled today" },
    { label: "Upcoming", value: stats?.upcomingCount ?? 0, hint: "Next 7 days" },
    {
      label: "Rx Today",
      value: stats?.prescriptionsToday ?? 0,
      hint: "Created today",
    },
    {
      label: "Total Rx",
      value: stats?.totalPrescriptions ?? 0,
      hint: role === "doctor" ? "Your prescriptions" : "All prescriptions",
    },
    {
      label: "Draft Rx",
      value: stats?.pendingDrafts ?? 0,
      hint: "Pending drafts",
    },
    {
      label: "Revenue",
      value: `$${(stats?.revenue ?? 0).toLocaleString()}`,
      hint: "Completed appts",
    },
    { label: "Active Doctors", value: stats?.activeDoctors ?? 0, hint: "On staff" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Overview
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
        {tiles.map((t, i) => (
          <div
            key={t.label}
            className="bg-surface p-5 rounded-xl border border-border animate-entrance"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              {t.label}
            </span>
            <div className="text-2xl font-semibold mt-1 tabular-nums">{t.value}</div>
            <div className="text-[10px] text-muted-foreground mt-2">{t.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center">
            <h3 className="font-semibold">Active Medical Staff</h3>
            <Link to="/doctors" className="text-xs font-semibold text-primary hover:underline">
              View Directory
            </Link>
          </div>
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
                  <th className="px-6 py-3 text-[10px] font-mono uppercase text-muted-foreground text-right">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {(stats?.doctors ?? []).slice(0, 5).map((d) => (
                  <tr key={d.id}>
                    <td className="px-6 py-4 font-medium">{d.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{d.specialization}</td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {d.working_hours?.open ?? "—"} – {d.working_hours?.close ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="px-2 py-1 bg-accent/10 text-accent-foreground text-[10px] font-bold rounded uppercase">
                        Available
                      </span>
                    </td>
                  </tr>
                ))}
                {(stats?.doctors ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-10 text-center text-sm text-muted-foreground"
                    >
                      No doctors yet.{" "}
                      <Link to="/doctors" className="text-primary hover:underline">
                        Add one
                      </Link>
                      .
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface rounded-xl border border-border p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold">Today's Schedule</h3>
              <span className="text-[10px] font-mono text-muted-foreground">
                {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </div>
            <div className="space-y-4">
              {(stats?.todayList ?? []).map((a) => (
                <div key={a.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-mono font-bold tabular-nums">
                      {formatAppointmentTime(a.appointment_time)}
                    </span>
                  </div>
                  <div className="flex-1 bg-muted/40 p-3 rounded-lg">
                    <div className="font-medium text-sm">{patientName(a.patient)}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.patient?.patient_code ?? "No patient ID"} •{" "}
                      {a.visit_reason ?? a.notes ?? "Consultation"} • {a.doctor?.name ?? "—"}
                    </div>
                  </div>
                </div>
              ))}
              {(stats?.todayList ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No appointments today.
                </p>
              )}
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold">Recent Prescriptions</h3>
              <Link
                to="/prescriptions"
                className="text-xs font-semibold text-primary hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="space-y-3">
              {(stats?.recentPrescriptions ?? []).map((prescription) => (
                <Link
                  key={prescription.id}
                  to="/prescriptions"
                  search={{ prescriptionId: prescription.id }}
                  className="block bg-muted/40 p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-sm">{prescription.prescription_number}</div>
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">
                      {prescription.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {patientName(prescription.patient)} • {prescription.doctor?.name ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {prescription.diagnosis ?? "No diagnosis"}
                  </div>
                </Link>
              ))}
              {(stats?.recentPrescriptions ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No prescriptions yet.
                </p>
              )}
            </div>
          </div>

          <div className="bg-primary text-primary-foreground rounded-xl p-6 space-y-4 shadow-xl shadow-primary/10">
            <h3 className="font-semibold leading-tight">Complete Clinic Profile</h3>
            <p className="text-xs opacity-80 leading-relaxed">
              Add working hours, consultation fees, and your professional address.
            </p>
            <Link
              to="/clinic-profile"
              className="block w-full py-2 bg-primary-foreground text-primary text-sm font-bold rounded-lg hover:opacity-90 transition-opacity text-center"
            >
              Edit Profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
