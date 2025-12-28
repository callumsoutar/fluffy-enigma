"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

interface Setting {
  id: string;
  category: string;
  setting_key: string;
  setting_value: unknown;
  data_type: string;
  description?: string;
  is_public?: boolean;
  is_required?: boolean;
}

interface SettingsResponse {
  settings: Setting[];
}

/**
 * Hook to manage settings for a specific category
 * @param category - The settings category to fetch (e.g., 'general', 'invoicing')
 */
export function useSettingsManager(category: string) {
  const queryClient = useQueryClient();

  // Fetch settings for the category
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<SettingsResponse>({
    queryKey: ["settings", category],
    queryFn: async () => {
      const response = await fetch(`/api/settings?category=${category}`);
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

  // Mutation to update a setting
  const updateMutation = useMutation({
    mutationFn: async ({
      key,
      value,
    }: {
      key: string;
      value: string | number | boolean | object;
    }) => {
      const response = await fetch(`/api/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          setting_key: key,
          setting_value: value,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update setting");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch settings
      queryClient.invalidateQueries({ queryKey: ["settings", category] });
    },
  });

  /**
   * Get the value of a specific setting by key
   * @param key - The setting key
   * @param defaultValue - Default value if setting not found
   */
  const getSettingValue = useCallback(
    <T = string>(key: string, defaultValue: T): T => {
      const setting = data?.settings?.find((s) => s.setting_key === key);
      if (!setting) return defaultValue;

      // Handle different data types
      const value = setting.setting_value;

      // If value is null or undefined, return default
      if (value === null || value === undefined) return defaultValue;

      // Return the value as-is if it matches the expected type
      return value as T;
    },
    [data]
  );

  /**
   * Update a setting value
   * @param key - The setting key
   * @param value - The new value
   */
  const updateSettingValue = useCallback(
    async (key: string, value: string | number | boolean | object) => {
      return updateMutation.mutateAsync({ key, value });
    },
    [updateMutation]
  );

  return {
    settings: data?.settings || [],
    isLoading,
    isUpdating: updateMutation.isPending,
    error,
    refetch,
    getSettingValue,
    updateSettingValue,
  };
}

