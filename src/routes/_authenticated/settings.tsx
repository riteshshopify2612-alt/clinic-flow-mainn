import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — CURA" }] }),
  component: Settings,
});

function Settings() {
  const { user, role } = useCurrentUser();
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          Account
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </div>
      <div className="bg-surface rounded-xl border border-border p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-muted-foreground">Email</div>
          <div className="col-span-2 font-mono text-xs">{user?.email}</div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-muted-foreground">Role</div>
          <div className="col-span-2 font-mono text-xs uppercase">{role}</div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-muted-foreground">User ID</div>
          <div className="col-span-2 font-mono text-xs break-all">{user?.id}</div>
        </div>
      </div>
    </div>
  );
}
