"use client";

import React, { useState } from "react";
import {
  IconBuilding,
  IconMail,
  IconSettings,
  IconDeviceFloppy,
  IconLoader2,
} from "@tabler/icons-react";
import * as Tabs from "@radix-ui/react-tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const generalTabs = [
  { id: "school-info", label: "School Information", icon: IconBuilding },
  { id: "contact-info", label: "Contact Information", icon: IconMail },
  { id: "system-settings", label: "System Settings", icon: IconSettings },
];

export function GeneralTab() {
  const [selectedTab, setSelectedTab] = useState("school-info");
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const tabsListRef = React.useRef<HTMLDivElement>(null);
  const [underlineStyle, setUnderlineStyle] = React.useState({
    left: 0,
    width: 0,
  });

  // Update underline position when active tab changes
  React.useEffect(() => {
    const activeElement = tabRefs.current[selectedTab];
    if (activeElement && tabsListRef.current) {
      const listRect = tabsListRef.current.getBoundingClientRect();
      const activeRect = activeElement.getBoundingClientRect();
      setUnderlineStyle({
        left: activeRect.left - listRect.left,
        width: activeRect.width,
      });
    }
  }, [selectedTab]);

  const {
    settings,
    getSettingValue,
    updateSettingValue,
    isLoading,
    isUpdating,
  } = useSettingsManager("general");

  // Local state for form values
  const [formData, setFormData] = useState({
    // School Information
    school_name: "",
    registration_number: "",
    description: "",
    website_url: "",
    // Contact Information
    contact_email: "",
    contact_phone: "",
    address: "",
    billing_address: "",
    gst_number: "",
    // System Settings
    timezone: "",
    currency: "",
  });

  // Initialize form data when settings load
  React.useEffect(() => {
    if (settings && settings.length > 0) {
      setFormData({
        school_name: getSettingValue("school_name", ""),
        registration_number: getSettingValue("registration_number", ""),
        description: getSettingValue("description", ""),
        website_url: getSettingValue("website_url", ""),
        contact_email: getSettingValue("contact_email", ""),
        contact_phone: getSettingValue("contact_phone", ""),
        address: getSettingValue("address", ""),
        billing_address: getSettingValue("billing_address", ""),
        gst_number: getSettingValue("gst_number", ""),
        timezone: getSettingValue("timezone", "Pacific/Auckland"),
        currency: getSettingValue("currency", "NZD"),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.length]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveSection = async (fields: string[]) => {
    try {
      const updates: Record<string, string> = {};
      fields.forEach((field) => {
        updates[field] = formData[field as keyof typeof formData];
      });

      await Promise.all(
        Object.entries(updates).map(([key, value]) =>
          updateSettingValue(key, value)
        )
      );

      toast.success("Settings saved successfully");
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
    <div className="w-full h-full">
      <Tabs.Root
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="w-full h-full flex flex-col"
      >
        <div className="w-full border-b border-gray-200 bg-white relative mb-8">
          <div className="flex items-center w-full overflow-x-auto scrollbar-hide scroll-smooth">
            <Tabs.List
              ref={tabsListRef}
              className="flex flex-row gap-1 min-h-[48px] relative min-w-max"
              aria-label="General configuration types"
            >
              {/* Animated underline */}
              <div
                className="absolute bottom-0 h-0.5 bg-indigo-700 transition-all duration-300 ease-out"
                style={{
                  left: `${underlineStyle.left}px`,
                  width: `${underlineStyle.width}px`,
                }}
              />
              {generalTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Tabs.Trigger
                    key={tab.id}
                    ref={(el) => {
                      tabRefs.current[tab.id] = el;
                    }}
                    value={tab.id}
                    className="inline-flex items-center gap-2 px-4 py-3 pb-1 text-base font-medium border-b-2 border-transparent transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 cursor-pointer data-[state=active]:text-indigo-800 data-[state=inactive]:text-gray-500 hover:text-indigo-600 whitespace-nowrap flex-shrink-0 min-h-[48px] min-w-[44px] touch-manipulation active:bg-gray-50 rounded-none"
                    style={{
                      background: "none",
                      boxShadow: "none",
                    }}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{tab.label}</span>
                  </Tabs.Trigger>
                );
              })}
            </Tabs.List>
          </div>
        </div>

        <div className="flex-1">
          <Tabs.Content value="school-info" className="outline-none">
            <div className="space-y-6 max-w-4xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="school_name"
                    className="text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    School Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="school_name"
                    placeholder="Flight School Name"
                    value={formData.school_name}
                    className="rounded-xl border-slate-200 h-11"
                    onChange={(e) =>
                      handleInputChange("school_name", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="registration_number"
                    className="text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    Registration Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="registration_number"
                    placeholder="ABC123"
                    value={formData.registration_number}
                    className="rounded-xl border-slate-200 h-11"
                    onChange={(e) =>
                      handleInputChange("registration_number", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="description"
                  className="text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of your flight school..."
                  rows={4}
                  value={formData.description}
                  className="rounded-xl border-slate-200 resize-none"
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="website_url"
                  className="text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                  Website URL
                </Label>
                <Input
                  id="website_url"
                  placeholder="https://www.yourflightschool.com"
                  value={formData.website_url}
                  className="rounded-xl border-slate-200 h-11"
                  onChange={(e) =>
                    handleInputChange("website_url", e.target.value)
                  }
                />
              </div>
              <div className="flex justify-end pt-4">
                <Button
                  onClick={() =>
                    handleSaveSection([
                      "school_name",
                      "registration_number",
                      "description",
                      "website_url",
                    ])
                  }
                  disabled={isUpdating}
                  className="bg-slate-900 text-white font-bold rounded-xl h-11 px-6 shadow-lg shadow-slate-900/10 hover:bg-slate-800 flex items-center gap-2"
                >
                  {isUpdating ? (
                    <IconLoader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <IconDeviceFloppy className="w-4 h-4" />
                  )}
                  Save School Information
                </Button>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="contact-info" className="outline-none">
            <div className="space-y-6 max-w-4xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="contact_email"
                    className="text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contact_email"
                    type="email"
                    placeholder="contact@flightschool.com"
                    value={formData.contact_email}
                    className="rounded-xl border-slate-200 h-11"
                    onChange={(e) =>
                      handleInputChange("contact_email", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="contact_phone"
                    className="text-xs font-bold uppercase tracking-wider text-slate-500"
                  >
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contact_phone"
                    placeholder="+1 (555) 123-4567"
                    value={formData.contact_phone}
                    className="rounded-xl border-slate-200 h-11"
                    onChange={(e) =>
                      handleInputChange("contact_phone", e.target.value)
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="address"
                  className="text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                  Physical Address
                </Label>
                <Textarea
                  id="address"
                  placeholder="123 Airport Road, Aviation City, AC 12345"
                  rows={2}
                  value={formData.address}
                  className="rounded-xl border-slate-200 resize-none"
                  onChange={(e) => handleInputChange("address", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="billing_address"
                  className="text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                  Billing Address
                </Label>
                <Textarea
                  id="billing_address"
                  placeholder="123 Airport Road, Aviation City, AC 12345"
                  rows={2}
                  value={formData.billing_address}
                  className="rounded-xl border-slate-200 resize-none"
                  onChange={(e) =>
                    handleInputChange("billing_address", e.target.value)
                  }
                />
                <p className="text-[11px] text-slate-500 font-medium">
                  This address will appear on invoices
                </p>
              </div>
              <div className="max-w-md space-y-2">
                <Label
                  htmlFor="gst_number"
                  className="text-xs font-bold uppercase tracking-wider text-slate-500"
                >
                  GST/Tax Number
                </Label>
                <Input
                  id="gst_number"
                  placeholder="12-345-678"
                  value={formData.gst_number}
                  className="rounded-xl border-slate-200 h-11"
                  onChange={(e) =>
                    handleInputChange("gst_number", e.target.value)
                  }
                />
                <p className="text-[11px] text-slate-500 font-medium">
                  Your GST or tax registration number for invoices
                </p>
              </div>
              <div className="flex justify-end pt-4">
                <Button
                  onClick={() =>
                    handleSaveSection([
                      "contact_email",
                      "contact_phone",
                      "address",
                      "billing_address",
                      "gst_number",
                    ])
                  }
                  disabled={isUpdating}
                  className="bg-slate-900 text-white font-bold rounded-xl h-11 px-6 shadow-lg shadow-slate-900/10 hover:bg-slate-800 flex items-center gap-2"
                >
                  {isUpdating ? (
                    <IconLoader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <IconDeviceFloppy className="w-4 h-4" />
                  )}
                  Save Contact Information
                </Button>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="system-settings" className="outline-none">
            <div className="space-y-8 max-w-4xl">
              {/* General System Settings */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <IconSettings className="w-4 h-4 text-slate-400" />
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                    General Settings
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="timezone"
                      className="text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      Default Timezone
                    </Label>
                    <Select
                      value={formData.timezone}
                      onValueChange={(value) => {
                        handleInputChange("timezone", value);
                        updateSettingValue("timezone", value);
                      }}
                    >
                      <SelectTrigger className="w-full h-11 rounded-xl border-slate-200">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Pacific/Auckland">
                          Pacific/Auckland (NZ)
                        </SelectItem>
                        <SelectItem value="Australia/Sydney">
                          Australia/Sydney
                        </SelectItem>
                        <SelectItem value="America/New_York">
                          America/New_York
                        </SelectItem>
                        <SelectItem value="America/Los_Angeles">
                          America/Los_Angeles
                        </SelectItem>
                        <SelectItem value="Europe/London">
                          Europe/London
                        </SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="currency"
                      className="text-xs font-bold uppercase tracking-wider text-slate-500"
                    >
                      Default Currency
                    </Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => {
                        handleInputChange("currency", value);
                        updateSettingValue("currency", value);
                      }}
                    >
                      <SelectTrigger className="w-full h-11 rounded-xl border-slate-200">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="NZD">
                          NZD - New Zealand Dollar
                        </SelectItem>
                        <SelectItem value="AUD">
                          AUD - Australian Dollar
                        </SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">
                          GBP - British Pound
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-600 font-medium">
                    These settings affect how dates, times, and currency are
                    displayed throughout the application.
                  </p>
                </div>
              </div>
            </div>
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}

