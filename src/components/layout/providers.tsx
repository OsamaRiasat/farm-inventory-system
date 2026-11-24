"use client";

import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

// Other users' saves show up when this tab comes back into focus, and on the live screens
// (dashboard, waiting transfers, slip lists) every 30 s — see refetchInterval in src/lib/api/queries.ts.
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
