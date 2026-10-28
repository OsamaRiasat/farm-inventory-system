"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { createItemSearch } from "@/lib/item-search";
import type { Item } from "@/types/domain";
import { api, type ReportFilters, type ReportType, type SlipFilters, type StockRow } from "./index";

// TanStack Query hooks over the API. Screens use these, never the mock directly.

export const keys = {
  farms: ["farms"] as const,
  items: ["items"] as const,
  suppliers: ["suppliers"] as const,
  stock: (farmId?: string) => ["stock", farmId] as const,
  waiting: (farmId?: string) => ["waiting", farmId] as const,
  slips: (filters: SlipFilters) => ["slips", filters] as const,
  slip: (id: string) => ["slip", id] as const,
  dashboard: ["dashboard"] as const,
  stockMatrix: ["stockMatrix"] as const,
  stockCard: (farmId: string, itemId: string) => ["stockCard", farmId, itemId] as const,
  transfers: (filters: { farmId?: string }) => ["transfers", filters] as const,
  corrections: (filters: { farmId?: string; status?: string }) => ["corrections", filters] as const,
  audit: (filters: { farmId?: string }) => ["audit", filters] as const,
  users: ["users"] as const,
  report: (type: string, filters: object) => ["report", type, filters] as const,
};

const REFERENCE_STALE = 5 * 60_000;

export function useFarms() {
  return useQuery({ queryKey: keys.farms, queryFn: api.listFarms, staleTime: REFERENCE_STALE });
}

export function useItems() {
  return useQuery({ queryKey: keys.items, queryFn: api.listItems, staleTime: REFERENCE_STALE });
}

/** itemId → item, empty until items load. */
export function useItemMap() {
  const { data } = useItems();
  return useMemo(() => new Map<string, Item>((data ?? []).map((i) => [i.id, i])), [data]);
}

/** Local search over the cached item list, so typing never waits for the network. */
export function useItemSearch() {
  const { data } = useItems();
  return useMemo(() => createItemSearch(data ?? []), [data]);
}

export function useSuppliers() {
  return useQuery({ queryKey: keys.suppliers, queryFn: api.listSuppliers, staleTime: REFERENCE_STALE });
}

const toStockMap = (rows: StockRow[]) => new Map(rows.map((r) => [r.itemId, r.qty]));

/** itemId → quantity on hand at one farm. */
export function useStock(farmId: string | undefined) {
  return useQuery({
    queryKey: keys.stock(farmId),
    queryFn: () => api.getStock(farmId!),
    enabled: !!farmId,
    select: toStockMap,
  });
}

export function useWaitingTransfers(farmId: string | undefined) {
  return useQuery({ queryKey: keys.waiting(farmId), queryFn: () => api.listWaitingTransfers(farmId!), enabled: !!farmId });
}

export function useSlips(filters: SlipFilters, enabled = true) {
  return useQuery({ queryKey: keys.slips(filters), queryFn: () => api.listSlips(filters), enabled });
}

export function useSlip(id: string) {
  return useQuery({ queryKey: keys.slip(id), queryFn: () => api.getSlip(id) });
}

export function useDashboard() {
  return useQuery({ queryKey: keys.dashboard, queryFn: api.getDashboard });
}

export function useStockMatrix() {
  return useQuery({ queryKey: keys.stockMatrix, queryFn: api.getStockMatrix });
}

export function useStockCard(farmId: string, itemId: string) {
  return useQuery({ queryKey: keys.stockCard(farmId, itemId), queryFn: () => api.getStockCard(farmId, itemId) });
}

export function useTransfers(filters: { farmId?: string } = {}) {
  return useQuery({ queryKey: keys.transfers(filters), queryFn: () => api.listTransfers(filters) });
}

export function useCorrectionRequests(filters: { farmId?: string; status?: "open" | "approved" | "rejected" } = {}) {
  return useQuery({ queryKey: keys.corrections(filters), queryFn: () => api.listCorrectionRequests(filters) });
}

export function useAudit(filters: { farmId?: string } = {}) {
  return useQuery({ queryKey: keys.audit(filters), queryFn: () => api.listAudit(filters) });
}

export function useUsers() {
  return useQuery({ queryKey: keys.users, queryFn: api.listUsers, staleTime: REFERENCE_STALE });
}

export function useReport(type: ReportType, filters: ReportFilters) {
  return useQuery({ queryKey: keys.report(type, filters), queryFn: () => api.getReport(type, filters) });
}

/**
 * A write. On success every query refreshes in the background (one slip moves stock, transfers and
 * the dashboard); the caller doesn't wait for that, so it can move on straight away.
 */
export function useApiMutation<I, O>(fn: (input: I) => Promise<O>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void client.invalidateQueries();
    },
  });
}
