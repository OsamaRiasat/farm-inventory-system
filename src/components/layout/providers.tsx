"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));

  // Demo: a save in another tab (farm) shows up here (admin) without a reload.
  useEffect(() => api.onExternalChange(() => client.invalidateQueries()), [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
