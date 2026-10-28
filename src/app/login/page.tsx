import Link from "next/link";
import { Bi } from "@/components/layout/bi";
import { LangOrderToggle } from "@/components/layout/lang-order-toggle";
import { LoginForm } from "./login-form";

// S1 — phase 1 mock login: pick a role (and farm). No password.
export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          <Bi id="app.title" />
        </h1>
        <LangOrderToggle />
      </div>
      <p className="text-sm text-muted">
        <Bi id="login.demoNote" inline />
      </p>
      <LoginForm />
      <Link href="/dev" className="self-center text-sm text-primary underline">
        <Bi id="login.demoTools" inline />
      </Link>
    </main>
  );
}
