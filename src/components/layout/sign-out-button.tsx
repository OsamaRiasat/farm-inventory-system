"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SESSION_KEY, signOut } from "@/lib/session";
import { Bi } from "./bi";

/** Ends the session on the server and forgets every loaded screen (the next user starts clean). */
export function SignOutButton() {
  const router = useRouter();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn min-h-10 px-3 text-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut();
        client.clear();
        client.setQueryData(SESSION_KEY, null);
        router.replace("/login");
      }}
    >
      <LogOut size={18} aria-hidden />
      <Bi id="nav.signOut" inline />
    </button>
  );
}
