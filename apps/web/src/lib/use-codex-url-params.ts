"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

function replaceSearchParams(
  pathname: string,
  router: ReturnType<typeof useRouter>,
  searchParams: URLSearchParams,
) {
  const q = searchParams.toString();
  router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
}

/** Read/write a single Codex list filter in the URL (CODEX-5b). */
export function useCodexUrlParam(
  name: string,
): [string | undefined, (value: string | undefined) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get(name) ?? undefined;

  const setValue = useCallback(
    (next: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === undefined || next === "") params.delete(name);
      else params.set(name, next);
      replaceSearchParams(pathname, router, params);
    },
    [name, pathname, router, searchParams],
  );

  return [value, setValue];
}

/** Tri-state bool filter: `1` = true, `0` = false, omitted = all. */
export function useCodexUrlBoolParam(
  name: string,
): [boolean | undefined, (value: boolean | undefined) => void] {
  const [raw, setRaw] = useCodexUrlParam(name);
  const value = raw === "1" ? true : raw === "0" ? false : undefined;

  const setValue = useCallback(
    (next: boolean | undefined) => {
      if (next === true) setRaw("1");
      else if (next === false) setRaw("0");
      else setRaw(undefined);
    },
    [setRaw],
  );

  return [value, setValue];
}

/** Integer URL param; omits from URL when equal to `defaultValue`. */
export function useCodexUrlIntParam(
  name: string,
  defaultValue = 0,
): [number, (value: number) => void] {
  const [raw, setRaw] = useCodexUrlParam(name);
  const parsed = raw != null ? parseInt(raw, 10) : defaultValue;
  const value = Number.isNaN(parsed) ? defaultValue : parsed;

  const setValue = useCallback(
    (next: number) => {
      if (next === defaultValue) setRaw(undefined);
      else setRaw(String(next));
    },
    [defaultValue, setRaw],
  );

  return [value, setValue];
}

/** String enum param; omits from URL when equal to `defaultValue`. */
export function useCodexUrlEnumParam<T extends string>(
  name: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [raw, setRaw] = useCodexUrlParam(name);
  const value = (raw as T | undefined) ?? defaultValue;

  const setValue = useCallback(
    (next: T) => {
      if (next === defaultValue) setRaw(undefined);
      else setRaw(next);
    },
    [defaultValue, setRaw],
  );

  return [value, setValue];
}
