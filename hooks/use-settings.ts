"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { Settings, PartialSettings, SettingGroup } from "@/lib/settings";
import { SETTING_GROUPS } from "@/lib/settings";

interface SettingsResponse {
  settings: Settings;
}

/**
 * Hook to manage settings - FLAT STRUCTURE
 * 
 * Uses the new flat JSONB-based settings architecture with:
 * - Defaults defined in code
 * - Only overrides stored in database
 * - Simple spread merge at runtime
 * 
 * @param group - Optional UI group filter (only affects which keys are returned, not storage)
 */
export function useSettingsManager(group?: SettingGroup) {
  const queryClient = useQueryClient();

  // Fetch effective settings (defaults merged with overrides)
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<SettingsResponse>({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await fetch(`/api/settings`);
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized");
        }
        if (response.status === 403) {
          throw new Error("Forbidden: Insufficient permissions");
        }
        throw new Error("Failed to fetch settings");
      }
      return response.json();
    },
    staleTime: 30_000, // Cache for 30 seconds
  });

  // Mutation to update settings
  const updateMutation = useMutation({
    mutationFn: async (newSettings: PartialSettings) => {
      const response = await fetch(`/api/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings: newSettings,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update settings");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch settings
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  // Get the full settings object
  const settings = data?.settings;

  // If a group is specified, filter to just those keys
  // Memoize to prevent new object references on each render
  const groupSettings = useMemo(() => {
    if (group && settings) {
      return getGroupedSettings(settings, group);
    }
    return settings;
  }, [settings, group]);

  /**
   * Get the value of a specific setting by key
   * Returns the effective value (default merged with override)
   * 
   * @param key - The setting key
   * @param defaultValue - Fallback value if setting not found
   */
  const getSettingValue = useCallback(
    <T = unknown>(key: keyof Settings, defaultValue?: T): T => {
      // Use allSettings (full settings) not groupSettings for lookups
      const fullSettings = data?.settings;
      if (!fullSettings) {
        return defaultValue as T;
      }
      
      const value = fullSettings[key];
      if (value === null || value === undefined) {
        return defaultValue as T;
      }
      
      return value as T;
    },
    [data?.settings]
  );

  /**
   * Update a single setting value
   * 
   * @param key - The setting key
   * @param value - The new value
   */
  const updateSettingValue = useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      return updateMutation.mutateAsync({ [key]: value } as PartialSettings);
    },
    [updateMutation]
  );

  /**
   * Update multiple settings at once
   * 
   * @param updates - Object with setting key-value pairs
   */
  const updateSettings = useCallback(
    async (updates: PartialSettings) => {
      return updateMutation.mutateAsync(updates);
    },
    [updateMutation]
  );

  return {
    settings: groupSettings,
    allSettings: settings,
    isLoading,
    isUpdating: updateMutation.isPending,
    error,
    refetch,
    getSettingValue,
    updateSettingValue,
    updateSettings,
  };
}

/**
 * Helper to filter settings to a specific UI group
 */
function getGroupedSettings(settings: Settings, group: SettingGroup): Partial<Settings> {
  const groupKeys = SETTING_GROUPS[group] as readonly (keyof Settings)[];
  const result: Partial<Settings> = {};
  
  for (const key of groupKeys) {
    if (key in settings) {
      (result as Record<string, unknown>)[key] = settings[key];
    }
  }
  
  return result;
}

/**
 * Hook to fetch all settings
 * Useful for contexts that need access to the full settings object
 */
export function useAllSettings() {
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<{ settings: Settings }>({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await fetch(`/api/settings`);
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized");
        }
        if (response.status === 403) {
          throw new Error("Forbidden: Insufficient permissions");
        }
        throw new Error("Failed to fetch settings");
      }
      return response.json();
    },
    staleTime: 30_000,
  });

  // Invalidate all settings queries
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  }, [queryClient]);

  return {
    settings: data?.settings,
    isLoading,
    error,
    refetch,
    invalidateAll,
  };
}
