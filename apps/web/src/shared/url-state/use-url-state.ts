"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { z } from "zod";
import {
  parseUrlState,
  toSearchParams,
  touchesFilters,
  type UrlStateSchema,
  withoutPagination,
} from "./url-state";

export interface UrlState<Values> {
  values: Values;
  setValues: (patch: Partial<Record<keyof Values & string, string | undefined>>) => void;
}

export function useUrlState<Schema extends UrlStateSchema>(
  schema: Schema
): UrlState<z.infer<Schema>> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaults = useMemo(() => schema.parse({}) as Record<string, unknown>, [schema]);

  const values = useMemo(
    () => parseUrlState(schema, new URLSearchParams(searchParams.toString())),
    [schema, searchParams]
  );

  const setValues = useCallback(
    (patch: Record<string, string | undefined>) => {
      const current = values as Record<string, unknown>;
      const base = touchesFilters(patch) ? withoutPagination(current) : current;
      const next = { ...base, ...patch };

      const query = toSearchParams(next, defaults).toString();
      router.replace(query === "" ? pathname : `${pathname}?${query}`);
    },
    [defaults, pathname, router, values]
  );

  return { values, setValues };
}
