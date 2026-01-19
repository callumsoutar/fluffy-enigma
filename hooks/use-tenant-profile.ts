"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { TenantProfile, TenantProfileUpdate } from "@/lib/settings";

interface TenantProfileResponse {
  profile: TenantProfile;
  message?: string;
}

/**
 * Hook to manage tenant profile data (organization info, contact details, branding)
 * 
 * This data is stored directly on the tenants table and includes:
 * - Organization name, description, registration number
 * - Contact information (email, phone, address)
 * - Branding (logo URL)
 * - Regional settings (timezone, currency)
 */
export function useTenantProfile() {
  const queryClient = useQueryClient();

  // Fetch tenant profile
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<TenantProfileResponse>({
    queryKey: ["tenant", "profile"],
    queryFn: async () => {
      const response = await fetch("/api/tenant/profile");
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized");
        }
        if (response.status === 403) {
          throw new Error("Forbidden: Insufficient permissions");
        }
        throw new Error("Failed to fetch tenant profile");
      }
      return response.json();
    },
    staleTime: 60_000, // Cache for 1 minute
  });

  // Mutation to update tenant profile
  const updateMutation = useMutation({
    mutationFn: async (updates: TenantProfileUpdate) => {
      const response = await fetch("/api/tenant/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update tenant profile");
      }

      return response.json() as Promise<TenantProfileResponse>;
    },
    onSuccess: (data) => {
      // Update the cache with the new profile
      queryClient.setQueryData(["tenant", "profile"], data);
    },
  });

  const profile = data?.profile;

  /**
   * Get a specific profile field value
   */
  const getProfileValue = useCallback(
    <K extends keyof TenantProfile>(key: K, defaultValue: TenantProfile[K]): TenantProfile[K] => {
      if (!profile) return defaultValue;
      const value = profile[key];
      return value ?? defaultValue;
    },
    [profile]
  );

  /**
   * Update a single profile field
   */
  const updateProfileValue = useCallback(
    async <K extends keyof TenantProfileUpdate>(key: K, value: TenantProfileUpdate[K]) => {
      return updateMutation.mutateAsync({ [key]: value });
    },
    [updateMutation]
  );

  /**
   * Update multiple profile fields at once
   */
  const updateProfile = useCallback(
    async (updates: TenantProfileUpdate) => {
      return updateMutation.mutateAsync(updates);
    },
    [updateMutation]
  );

  return {
    profile,
    isLoading,
    isUpdating: updateMutation.isPending,
    error,
    refetch,
    getProfileValue,
    updateProfileValue,
    updateProfile,
  };
}
