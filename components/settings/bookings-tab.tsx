"use client";

import React, { useState } from "react";
import {
  IconDeviceFloppy,
  IconLoader2,
  IconClock,
} from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSettingsManager } from "@/hooks/use-settings";
import { toast } from "sonner";
import { CancellationCategoriesConfig } from "./CancellationCategoriesConfig";

export function BookingsTab() {
  const {
    settings,
    getSettingValue,
    updateSettings,
    isLoading,
    isUpdating,
  } = useSettingsManager("bookings");

  const [formData, setFormData] = useState({
    default_booking_duration_hours: 2,
    minimum_booking_duration_minutes: 30,
  });

  // Initialize form data when settings load
  React.useEffect(() => {
    if (settings) {
      setFormData({
        default_booking_duration_hours: getSettingValue(
          "default_booking_duration_hours",
          2
        ),
        minimum_booking_duration_minutes: getSettingValue(
          "minimum_booking_duration_minutes",
          30
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const handleInputChange = (
    field: string,
    value: string | number | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveAll = async () => {
    try {
      await updateSettings(formData);
      toast.success("Booking settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <IconLoader2 className="w-8 h-8 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-500 font-medium mt-2">
          Loading settings...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Booking Duration */}
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <IconClock className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
            Booking Duration
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label
              htmlFor="default_booking_duration_hours"
              className="text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Default Duration (Hours)
            </Label>
            <Input
              id="default_booking_duration_hours"
              type="number"
              min="0"
              step="0.5"
              value={formData.default_booking_duration_hours}
              className="rounded-xl border-slate-200 h-11"
              onChange={(e) =>
                handleInputChange(
                  "default_booking_duration_hours",
                  parseFloat(e.target.value) || 0
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="minimum_booking_duration_minutes"
              className="text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Minimum Duration (Minutes)
            </Label>
            <Input
              id="minimum_booking_duration_minutes"
              type="number"
              min="0"
              value={formData.minimum_booking_duration_minutes}
              className="rounded-xl border-slate-200 h-11"
              onChange={(e) =>
                handleInputChange(
                  "minimum_booking_duration_minutes",
                  parseInt(e.target.value) || 0
                )
              }
            />
          </div>
        </div>
      </div>

      <div className="pt-8 border-t border-slate-100">
        <CancellationCategoriesConfig />
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-8 border-t border-slate-100">
        <Button
          onClick={handleSaveAll}
          disabled={isUpdating}
          className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] font-semibold border-none flex items-center gap-2 px-6"
        >
          {isUpdating ? (
            <IconLoader2 className="w-4 h-4 animate-spin" />
          ) : (
            <IconDeviceFloppy className="w-4 h-4" />
          )}
          Save All Booking Settings
        </Button>
      </div>
    </div>
  );
}
