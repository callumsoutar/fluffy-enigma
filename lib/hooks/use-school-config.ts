"use client"

import { useQuery } from "@tanstack/react-query"
import type { SchoolConfig } from "@/lib/utils/school-config"
import { DEFAULT_SCHOOL_CONFIG } from "@/lib/utils/school-config"

async function fetchSchoolConfig(): Promise<SchoolConfig> {
  const res = await fetch("/api/public-config")
  if (!res.ok) {
    // If we can't fetch config (auth missing / transient error), fall back to defaults
    // rather than breaking time handling.
    return DEFAULT_SCHOOL_CONFIG
  }
  const data = (await res.json()) as { config?: SchoolConfig }
  return data.config ?? DEFAULT_SCHOOL_CONFIG
}

export function useSchoolConfig() {
  return useQuery({
    queryKey: ["public-config"],
    queryFn: fetchSchoolConfig,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    placeholderData: DEFAULT_SCHOOL_CONFIG,
  })
}


