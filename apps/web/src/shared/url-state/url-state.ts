import type { z } from "zod";
import { CURSOR_PARAM, CURSOR_STACK_PARAM } from "./pagination";

export type UrlStateSchema = z.ZodObject<z.ZodRawShape>;

const PAGINATION_PARAMS: readonly string[] = [CURSOR_PARAM, CURSOR_STACK_PARAM];

export function parseUrlState<Schema extends UrlStateSchema>(
  schema: Schema,
  params: URLSearchParams
): z.infer<Schema> {
  const raw: Record<string, string> = {};
  for (const key of Object.keys(schema.shape)) {
    const value = params.get(key);
    if (value !== null) raw[key] = value;
  }

  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const accepted: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const field = schema.shape[key] as z.ZodType | undefined;
    if (field?.safeParse(value).success === true) accepted[key] = value;
  }

  return schema.parse(accepted);
}

export function toSearchParams(
  values: Record<string, unknown>,
  defaults: Record<string, unknown>
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    if (value === defaults[key]) continue;
    params.set(key, String(value));
  }

  params.sort();
  return params;
}

export function withoutPagination(values: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...values };
  for (const key of PAGINATION_PARAMS) delete next[key];
  return next;
}

export function touchesFilters(patch: Record<string, unknown>): boolean {
  return Object.keys(patch).some((key) => !PAGINATION_PARAMS.includes(key));
}
