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
    updateSettingValue,
    isLoading,
    isUpdating,
  } = useSettingsManager("general");

  // Extract business hours from settings
  const businessHours = React.useMemo(() => {
    const openTime = getSettingValue<string>("business_open_time", "09:00:00");
    const closeTime = getSettingValue<string>("business_close_time", "17:00:00");
    const is24Hours = getSettingValue<boolean>("business_is_24_hours", false);
    const isClosed = getSettingValue<boolean>("business_is_closed", false);

    return {
      open_time: openTime,
      close_time: closeTime,
      is_24_hours: is24Hours,
      is_closed: isClosed,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("17:00");
  const [isClosed, setIsClosed] = useState(false);
  const [is24Hours, setIs24Hours] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const timeOptions = generateTimeOptions();

  // Initialize state based on current business hours
  useEffect(() => {
    if (settings && settings.length > 0) {
      const openTimeStr = businessHours.open_time.substring(0, 5);
      const closeTimeStr = businessHours.close_time.substring(0, 5);
      setOpenTime(openTimeStr);
      setCloseTime(closeTimeStr);
      setIsClosed(businessHours.is_closed);
      setIs24Hours(businessHours.is_24_hours);
      setHasChanges(false);
    }
  }, [businessHours, settings]);

  const handleTimeChange = (field: string, value: string | boolean) => {
    if (field === "openTime") setOpenTime(value as string);
    if (field === "closeTime") setCloseTime(value as string);
    if (field === "isClosed") setIsClosed(value as boolean);
    if (field === "is24Hours") setIs24Hours(value as boolean);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await Promise.all([
        updateSettingValue(
          "business_open_time",
          openTime.length === 5 ? `${openTime}:00` : openTime
        ),
        updateSettingValue(
          "business_close_time",
          closeTime.length === 5 ? `${closeTime}:00` : closeTime
        ),
        updateSettingValue("business_is_24_hours", is24Hours),
        updateSettingValue("business_is_closed", isClosed),
      ]);
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
    const openTimeStr = businessHours.open_time.substring(0, 5);
    const closeTimeStr = businessHours.close_time.substring(0, 5);
    setOpenTime(openTimeStr);
    setCloseTime(closeTimeStr);
    setIsClosed(businessHours.is_closed);
    setIs24Hours(businessHours.is_24_hours);
    setHasChanges(false);
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
            className="bg-slate-900 text-white font-bold rounded-xl h-11 px-6 shadow-lg shadow-slate-900/10 hover:bg-slate-800 flex items-center gap-2"
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

