import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Users,
  Stethoscope,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
  Activity,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useQueryClient } from "@tanstack/react-query";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/prescriptions", label: "Prescriptions", icon: ClipboardList },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/doctors", label: "Doctors", icon: Stethoscope },
  { to: "/clinic-profile", label: "Clinic Profile", icon: Building2 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { user, role } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (user?.user_metadata?.full_name ?? user?.email ?? "?")
    .split(" ")
    .map((s: string) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 bottom-0 w-64 bg-surface border-r border-border z-40 flex flex-col transition-transform md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="size-8 bg-primary rounded flex items-center justify-center text-primary-foreground">
            <Activity className="size-4" />
          </div>
          <span className="font-semibold tracking-tight text-lg">CURA Admin</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  active
                    ? "bg-primary/5 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2">
            <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold truncate">
                {user?.user_metadata?.full_name ?? user?.email}
              </span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                {role ?? "Member"}
              </span>
            </div>
            <button
              onClick={signOut}
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="md:ml-64 min-h-screen flex flex-col">
        <header className="sticky top-0 h-16 bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-8 flex items-center justify-between z-20 gap-4">
          <button
            className="md:hidden p-2 -ml-2 text-muted-foreground"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search patients, doctors..."
              className="w-full bg-muted/60 border border-transparent rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-border focus:bg-surface transition-all"
            />
          </div>

          <div className="hidden sm:flex flex-col text-right">
            <span className="text-[10px] text-muted-foreground font-mono uppercase">
              System Status
            </span>
            <div className="flex items-center gap-1.5 justify-end">
              <div className="size-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-xs font-medium">Online</span>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
