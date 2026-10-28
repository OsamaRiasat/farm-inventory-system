// The only module screens use for data. Phase 1 points at the mock; later the same functions
// call the real backend and no screen changes. See docs/kb/03-data-and-api.md.

import { mockApi } from "./mock";

export const api = mockApi;
export type Api = typeof api;

export { ApiError } from "./errors";
export type * from "./types";
