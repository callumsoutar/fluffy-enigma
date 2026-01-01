"use client";

import React, { useState, useEffect } from "react";
import {
  IconCalendar,
  IconDeviceFloppy,
  IconLoader2,
  IconInfoCircle,
} from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsManager } from "@/hooks/use-settings";
import { toast } from "sonner";

const months = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export function MembershipYearConfig() {
  const {
    settings,
    getSettingValue,
    updateSettingValue,
    isLoading,
    isUpdating,
  } = useSettingsManager("memberships");

  const [formData, setFormData] = useState({
    start_month: "4",
    start_day: "1",
    end_month: "3",
    end_day: "31",
    description: "Membership year runs from April 1st to March 31st",
  });

  // Initialize form data when settings load
  useEffect(() => {
    if (settings && settings.length > 0) {
      const membershipYear = getSettingValue<{
        start_month?: number;
        start_day?: number;
        end_month?: number;
        end_day?: number;
        description?: string;
      }>("membership_year", {});
      if (membershipYear && Object.keys(membershipYear).length > 0) {
        setFormData({
          start_month: (membershipYear.start_month || 4).toString(),
          start_day: (membershipYear.start_day || 1).toString(),
          end_month: (membershipYear.end_month || 3).toString(),
          end_day: (membershipYear.end_day || 31).toString(),
          description: membershipYear.description || "",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.length]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      
      // Auto-generate description if start date changes
      if (field === "start_month" || field === "start_day") {
        const startMonthName = months.find(m => m.value === newData.start_month)?.label;
        const startDay = newData.start_day;
        
        // Calculate end date (day before start date in the following year)
        // For simplicity, we just show the start date in the description
        newData.description = `Membership year starts on ${startMonthName} ${startDay}${getOrdinalNum(parseInt(startDay))}.`;
      }
      
      return newData;
    });
  };

  const getOrdinalNum = (n: number) => {
    return n > 0 ? ["th", "st", "nd", "rd"][(n > 3 && n < 21) || n % 10 > 3 ? 0 : n % 10] : "";
  };

  const handleSave = async () => {
    try {
      const membershipYearValue = {
        start_month: parseInt(formData.start_month),
        start_day: parseInt(formData.start_day),
        end_month: parseInt(formData.end_month),
        end_day: parseInt(formData.end_day),
        description: formData.description,
      };

      await updateSettingValue("membership_year", membershipYearValue);
      toast.success("Membership year settings saved successfully");
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
    <div className="space-y-8 max-w-4xl">
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <IconCalendar className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
            Membership Year Configuration
          </h3>
        </div>

        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3">
          <IconInfoCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-blue-900">About Membership Year</p>
            <p className="text-xs text-blue-700 leading-relaxed">
              These settings define when your organization&apos;s membership year begins. 
              This is used to calculate expiry dates for annual memberships.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="start_month"
                className="text-xs font-bold uppercase tracking-wider text-slate-500"
              >
                Start Month
              </Label>
              <Select
                value={formData.start_month}
                onValueChange={(value) => handleInputChange("start_month", value)}
              >
                <SelectTrigger className="w-full h-11 rounded-xl border-slate-200">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="start_day"
                className="text-xs font-bold uppercase tracking-wider text-slate-500"
              >
                Start Day
              </Label>
              <Input
                id="start_day"
                type="number"
                min="1"
                max="31"
                placeholder="1"
                value={formData.start_day}
                className="rounded-xl border-slate-200 h-11"
                onChange={(e) =>
                  handleInputChange("start_day", e.target.value)
                }
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="text-xs font-bold uppercase tracking-wider text-slate-500"
              >
                Description
              </Label>
              <Input
                id="description"
                placeholder="e.g. Annual membership cycle"
                value={formData.description}
                className="rounded-xl border-slate-200 h-11 bg-slate-50"
                readOnly
              />
              <p className="text-[11px] text-slate-500 font-medium">
                Auto-generated based on start date
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-8 border-t border-slate-100">
          <Button
            onClick={handleSave}
            disabled={isUpdating}
            className="bg-slate-900 text-white font-bold rounded-xl h-11 px-6 shadow-lg shadow-slate-900/10 hover:bg-slate-800 flex items-center gap-2"
          >
            {isUpdating ? (
              <IconLoader2 className="w-4 h-4 animate-spin" />
            ) : (
              <IconDeviceFloppy className="w-4 h-4" />
            )}
            Save Membership Year Settings
          </Button>
        </div>
      </div>
    </div>
  );
}

