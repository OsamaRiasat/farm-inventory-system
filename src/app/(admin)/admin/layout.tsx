import { Suspense } from "react";
import { AdminGate } from "@/components/layout/admin-gate";
import { AdminNav, AdminNavLinks } from "@/components/layout/admin-nav";
import { AdminTopBar } from "@/components/layout/admin-top-bar";
import { Bi } from "@/components/layout/bi";

// Accounts Admin frame: sidebar + top bar with the farm filter that applies to every screen.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 h-dvh w-16 shrink-0 overflow-y-auto border-r border-line bg-surface p-2 lg:w-60">
        <div className="mb-4 hidden px-3 pt-2 text-sm font-semibold lg:block">
          <Bi id="app.title" />
        </div>
        <Suspense fallback={<AdminNavLinks />}>
          <AdminNav />
        </Suspense>
      </aside>
      <div className="min-w-0 flex-1">
        <AdminTopBar />
        <main className="p-4 lg:p-6">
          <AdminGate>{children}</AdminGate>
        </main>
      </div>
    </div>
  );
}
