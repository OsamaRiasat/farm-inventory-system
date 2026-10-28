import { Bi } from "@/components/layout/bi";
import { AdminDashboard } from "./dashboard";

// A1 — Accounts Admin dashboard.
export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">
        <Bi id="nav.dashboard" />
      </h1>
      <AdminDashboard />
    </div>
  );
}
