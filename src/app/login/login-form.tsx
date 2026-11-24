"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bi } from "@/components/layout/bi";
import { SESSION_KEY, signIn, useSession } from "@/lib/session";
import type { MsgId } from "@/lib/i18n";

/** S1 — username + password. Farm User → their farm's home; Accounts Admin → dashboard. */
export function LoginForm() {
  const router = useRouter();
  const client = useQueryClient();
  const [error, setError] = useState<MsgId | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const session = useSession();

  // Already signed in (opened "/" or the login again): straight to Home.
  useEffect(() => {
    if (session) router.replace(session.role === "admin" ? "/admin" : "/farm");
  }, [session, router]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const session = await signIn(String(form.get("username") ?? ""), String(form.get("password") ?? ""));
      if (!session) {
        setError("err.wrongLogin");
        passwordRef.current?.select();
        return;
      }
      // A different user may have used this browser: start from fresh data.
      client.clear();
      client.setQueryData(SESSION_KEY, session);
      router.replace(session.role === "admin" ? "/admin" : "/farm");
    } catch {
      setError("err.notSaved");
    } finally {
      setBusy(false);
    }
  }

  /** Enter in Username moves to Password; Enter in Password signs in. */
  function usernameEnter(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key === "Enter" && (e.target as HTMLInputElement).name === "username") {
      e.preventDefault();
      passwordRef.current?.focus();
    }
  }

  return (
    <form onSubmit={submit} onKeyDown={usernameEnter} className="card flex flex-col gap-3 p-4" autoComplete="on">
      <label className="flex flex-col gap-1 text-sm font-medium">
        <Bi id="login.username" />
        <input
          name="username"
          className="input"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          dir="ltr"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        <Bi id="login.password" />
        <input ref={passwordRef} name="password" type="password" className="input" autoComplete="current-password" required dir="ltr" />
      </label>
      {error && (
        <p role="alert" className="font-medium text-danger">
          <Bi id={error} inline />
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-lg" disabled={busy} data-save>
        <Bi id="login.signIn" inline />
      </button>
    </form>
  );
}
