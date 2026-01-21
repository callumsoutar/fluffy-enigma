"use client";

import React, { useState, useEffect } from "react";
import { IconLoader2, IconClock } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useSettingsManager } from "@/hooks/use-settings";
import { formatTimeForDisplay } from "@/lib/utils";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";

// Generate time options for dropdowns (30-minute intervals)
const generateTimeOptions = () => {
  const times = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, "0")}:${minute
        .toString()
        .padStart(2, "0")}`;
      const displayTime = formatTimeForDisplay(timeString);
      times.push({ value: timeString, label: displayTime });
    }
  }
  return times;
};

export function BusinessHoursConfig() {
  const {
    settings,
    getSettingValue,
    updateSettings,
    isLoading,
    isUpdating,
  } = useSettingsManager("general");

  // Initial state uses central defaults (substring to get HH:MM from HH:MM:SS)
  const [openTime, setOpenTime] = useState(DEFAULT_SETTINGS.business_open_time.substring(0, 5));
  const [closeTime, setCloseTime] = useState(DEFAULT_SETTINGS.business_close_time.substring(0, 5));
  const [isClosed, setIsClosed] = useState(DEFAULT_SETTINGS.business_is_closed);
  const [is24Hours, setIs24Hours] = useState(DEFAULT_SETTINGS.business_is_24_hours);
  const [hasChanges, setHasChanges] = useState(false);

  const timeOptions = generateTimeOptions();

  // Initialize state based on current business hours
  useEffect(() => {
    if (settings) {
      const openTimeValue = getSettingValue("business_open_time", DEFAULT_SETTINGS.business_open_time);
      const closeTimeValue = getSettingValue("business_close_time", DEFAULT_SETTINGS.business_close_time);
      const is24HoursValue = getSettingValue("business_is_24_hours", DEFAULT_SETTINGS.business_is_24_hours);
      const isClosedValue = getSettingValue("business_is_closed", DEFAULT_SETTINGS.business_is_closed);

      const openTimeStr = openTimeValue.substring(0, 5);
      const closeTimeStr = closeTimeValue.substring(0, 5);
      setOpenTime(openTimeStr);
      setCloseTime(closeTimeStr);
      setIsClosed(isClosedValue);
      setIs24Hours(is24HoursValue);
      setHasChanges(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const handleTimeChange = (field: string, value: string | boolean) => {
    if (field === "openTime") setOpenTime(value as string);
    if (field === "closeTime") setCloseTime(value as string);
    if (field === "isClosed") setIsClosed(value as boolean);
    if (field === "is24Hours") setIs24Hours(value as boolean);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateSettings({
        business_open_time: openTime.length === 5 ? `${openTime}:00` : openTime,
        business_close_time: closeTime.length === 5 ? `${closeTime}:00` : closeTime,
        business_is_24_hours: is24Hours,
        business_is_closed: isClosed,
      });
      setHasChanges(false);
      toast.success("Business hours updated successfully");
    } catch (error) {
      console.error("Error updating business hours:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update business hours"
      );
    }
  };

  const handleReset = () => {
    if (settings) {
      const openTimeValue = getSettingValue("business_open_time", DEFAULT_SETTINGS.business_open_time);
      const closeTimeValue = getSettingValue("business_close_time", DEFAULT_SETTINGS.business_close_time);
      const is24HoursValue = getSettingValue("business_is_24_hours", DEFAULT_SETTINGS.business_is_24_hours);
      const isClosedValue = getSettingValue("business_is_closed", DEFAULT_SETTINGS.business_is_closed);

      const openTimeStr = openTimeValue.substring(0, 5);
      const closeTimeStr = closeTimeValue.substring(0, 5);
      setOpenTime(openTimeStr);
      setCloseTime(closeTimeStr);
      setIsClosed(isClosedValue);
      setIs24Hours(is24HoursValue);
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <IconLoader2 className="w-6 h-6 animate-spin mr-2 text-slate-400" />
        <span className="text-slate-500 font-medium">Loading business hours...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <IconClock className="w-4 h-4 text-slate-400" />
        <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
          Business Hours
        </h4>
      </div>

      {/* Business Status Options */}
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="businessStatus"
            checked={!isClosed && !is24Hours}
            onChange={() => {
              handleTimeChange("isClosed", false);
              handleTimeChange("is24Hours", false);
            }}
            className="text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-slate-700 font-medium">Regular hours</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="businessStatus"
            checked={is24Hours && !isClosed}
            onChange={() => {
              handleTimeChange("is24Hours", true);
              handleTimeChange("isClosed", false);
            }}
            className="text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-slate-700 font-medium">24/7 operations</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="businessStatus"
            checked={isClosed}
            onChange={() => {
              handleTimeChange("isClosed", true);
              handleTimeChange("is24Hours", false);
            }}
            className="text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-slate-700 font-medium">Closed</span>
        </label>
      </div>

      {/* Time Selection - Only show if not closed or 24/7 */}
      {!isClosed && !is24Hours && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label
              htmlFor="openTime"
              className="text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Opening Time
            </Label>
            <Select
              value={openTime}
              onValueChange={(value) => handleTimeChange("openTime", value)}
            >
              <SelectTrigger className="w-full h-11 rounded-xl border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {timeOptions.map((time) => (
                  <SelectItem key={time.value} value={time.value}>
                    {time.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="closeTime"
              className="text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Closing Time
            </Label>
            <Select
              value={closeTime}
              onValueChange={(value) => handleTimeChange("closeTime", value)}
            >
              <SelectTrigger className="w-full h-11 rounded-xl border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {timeOptions.map((time) => (
                  <SelectItem key={time.value} value={time.value}>
                    {time.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isUpdating}
            className="rounded-xl h-11 px-6 border-slate-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isUpdating}
            className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-100 transition-all active:scale-[0.98] font-semibold border-none flex items-center gap-2 px-6"
          >
            {isUpdating ? (
              <>
                <IconLoader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
