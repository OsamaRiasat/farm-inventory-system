import { Bi } from "@/components/layout/bi";
import { LangOrderToggle } from "@/components/layout/lang-order-toggle";
import { LoginForm } from "./login-form";

// S1 — sign in with the username and password the Accounts Admin gave you.
export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          <Bi id="app.title" />
        </h1>
        <LangOrderToggle />
      </div>
      <LoginForm />
      <p className="text-sm text-muted">
        <Bi id="login.help" inline />
      </p>
    </main>
  );
}
