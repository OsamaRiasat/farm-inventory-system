// The only module screens use for data: typed functions over the backend's /api routes.
// See docs/kb/03-data-and-api.md for the contract.

import { httpApi } from "./http";

export const api = httpApi;
export type Api = typeof api;

export { ApiError } from "./errors";
export type * from "./types";
