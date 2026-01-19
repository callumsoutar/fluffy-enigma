"use client";

import React, { useState } from "react";
import {
  IconDeviceFloppy,
  IconLoader2,
  IconClock,
  IconLock,
  IconCalendarEvent,
} from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettingsManager } from "@/hooks/use-settings";
import { toast } from "sonner";

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
    maximum_booking_duration_hours: 8,
    booking_buffer_minutes: 15,
    allow_past_bookings: false,
    require_instructor_for_solo: true,
    require_flight_authorization_for_solo: false,
    auto_cancel_unpaid_hours: 72,
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
        maximum_booking_duration_hours: getSettingValue(
          "maximum_booking_duration_hours",
          8
        ),
        booking_buffer_minutes: getSettingValue(
          "booking_buffer_minutes",
          15
        ),
        allow_past_bookings: getSettingValue(
          "allow_past_bookings",
          false
        ),
        require_instructor_for_solo: getSettingValue(
          "require_instructor_for_solo",
          true
        ),
        require_flight_authorization_for_solo: getSettingValue(
          "require_flight_authorization_for_solo",
          false
        ),
        auto_cancel_unpaid_hours: getSettingValue(
          "auto_cancel_unpaid_hours",
          72
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
    <div className="space-y-12 max-w-4xl">
      {/* Booking Duration */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <IconClock className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
            Booking Duration
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          <div className="space-y-2">
            <Label
              htmlFor="maximum_booking_duration_hours"
              className="text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Maximum Duration (Hours)
            </Label>
            <Input
              id="maximum_booking_duration_hours"
              type="number"
              min="0"
              value={formData.maximum_booking_duration_hours}
              className="rounded-xl border-slate-200 h-11"
              onChange={(e) =>
                handleInputChange(
                  "maximum_booking_duration_hours",
                  parseInt(e.target.value) || 0
                )
              }
            />
          </div>
        </div>
      </div>

      {/* Booking Rules */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <IconCalendarEvent className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
            Booking Rules
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label
              htmlFor="booking_buffer_minutes"
              className="text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Buffer Between Bookings (Minutes)
            </Label>
            <Input
              id="booking_buffer_minutes"
              type="number"
              min="0"
              value={formData.booking_buffer_minutes}
              className="rounded-xl border-slate-200 h-11"
              onChange={(e) =>
                handleInputChange(
                  "booking_buffer_minutes",
                  parseInt(e.target.value) || 0
                )
              }
            />
            <p className="text-[11px] text-slate-500 font-medium">
              Minimum time between consecutive bookings
            </p>
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="auto_cancel_unpaid_hours"
              className="text-xs font-bold uppercase tracking-wider text-slate-500"
            >
              Auto-Cancel Unpaid (Hours)
            </Label>
            <Input
              id="auto_cancel_unpaid_hours"
              type="number"
              min="0"
              value={formData.auto_cancel_unpaid_hours}
              className="rounded-xl border-slate-200 h-11"
              onChange={(e) =>
                handleInputChange(
                  "auto_cancel_unpaid_hours",
                  parseInt(e.target.value) || 0
                )
              }
            />
            <p className="text-[11px] text-slate-500 font-medium">
              Hours after which unpaid bookings are auto-cancelled
            </p>
          </div>
        </div>
      </div>

      {/* Booking Permissions */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <IconLock className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
            Booking Permissions
          </h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="space-y-0.5">
              <Label
                htmlFor="allow_past_bookings"
                className="text-sm font-bold text-slate-900"
              >
                Allow Past Bookings
              </Label>
              <p className="text-[11px] text-slate-500 font-medium">
                Allow creating bookings in the past
              </p>
            </div>
            <Switch
              id="allow_past_bookings"
              checked={formData.allow_past_bookings}
              onCheckedChange={(checked) =>
                handleInputChange("allow_past_bookings", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="space-y-0.5">
              <Label
                htmlFor="require_instructor_for_solo"
                className="text-sm font-bold text-slate-900"
              >
                Require Instructor Approval for Solo
              </Label>
              <p className="text-[11px] text-slate-500 font-medium">
                Solo bookings must be approved by an instructor
              </p>
            </div>
            <Switch
              id="require_instructor_for_solo"
              checked={formData.require_instructor_for_solo}
              onCheckedChange={(checked) =>
                handleInputChange("require_instructor_for_solo", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="space-y-0.5">
              <Label
                htmlFor="require_flight_authorization_for_solo"
                className="text-sm font-bold text-slate-900"
              >
                Require Flight Authorization for Solo
              </Label>
              <p className="text-[11px] text-slate-500 font-medium">
                Solo flights require flight authorization before checkout
              </p>
            </div>
            <Switch
              id="require_flight_authorization_for_solo"
              checked={formData.require_flight_authorization_for_solo}
              onCheckedChange={(checked) =>
                handleInputChange(
                  "require_flight_authorization_for_solo",
                  checked
                )
              }
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-8 border-t border-slate-100">
        <Button
          onClick={handleSaveAll}
          disabled={isUpdating}
          className="bg-slate-900 text-white font-bold rounded-xl h-11 px-6 shadow-lg shadow-slate-900/10 hover:bg-slate-800 flex items-center gap-2"
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
